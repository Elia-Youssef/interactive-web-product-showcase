import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { devClientStubResponse } from './devClientStub.ts'

describe('the dev client stub', () => {
  it('answers the client entry request and lets every other URL through', () => {
    expect(devClientStubResponse('/@vite/client'), 'the entry serves the stub').toBeTruthy()
    expect(devClientStubResponse('/@vite/client?t=1'), 'the query is not the address').toBeTruthy()
    expect(devClientStubResponse('/@vite/env')).toBeNull()
    expect(devClientStubResponse('/src/app/App.tsx')).toBeNull()
    expect(devClientStubResponse('/')).toBeNull()
  })

  it('exports the surface the served modules import', () => {
    const stub = devClientStubResponse('/@vite/client') ?? ''
    for (const exported of ['createHotContext', 'updateStyle', 'removeStyle', 'injectQuery']) {
      expect(stub, `the stub must export ${exported}`).toContain(`export function ${exported}`)
    }
  })

  it('serves no socket and no reconnect polling anywhere in the stub', () => {
    const stub = devClientStubResponse('/@vite/client') ?? ''
    expect(stub).not.toContain('WebSocket')
    expect(stub).not.toContain('connect')
  })

  it('exports every name the installed vite client exports', () => {
    const stub = devClientStubResponse('/@vite/client') ?? ''
    const real = readFileSync(REAL_CLIENT_PATH, 'utf-8')
    const stubNames = new Set(exportedNames(stub))
    const missing = exportedNames(real).filter((name) => !stubNames.has(name))
    expect(
      missing,
      'the stand-in must export every name the real client exports; the served modules import them blindly',
    ).toEqual([])
  })
})

// The client Vite serves at /@vite/client, read from the installed package.
// Against the pinned vite this is dist/client/client.mjs: the dev server
// serves that file's own body (with the env import rewritten), while
// bundledDevClient.mjs is only inlined into the fallback page it generates
// for missing html files.
const REAL_CLIENT_PATH = fileURLToPath(
  new URL('../node_modules/vite/dist/client/client.mjs', import.meta.url),
)

// The names a plain JavaScript module exports, through the TypeScript
// compiler API: named export clauses such as `export { a, b }` and the
// exported declarations that carry a name.
function exportedNames(source: string): readonly string[] {
  const file = ts.createSourceFile(
    'client.mjs',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  )
  const names: string[] = []
  for (const statement of file.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        names.push(element.name.text)
      }
      continue
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (exported !== true) {
      continue
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      names.push(statement.name.text)
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.push(declaration.name.text)
        }
      }
    }
  }
  return names
}
