// Capture the installed Vite plugins' generated imports before resolution.
// No target source is read or executed, no server starts, and no bundle is written.
import { posix, resolve } from 'node:path'
import ts from 'typescript'
import { build } from 'vite'
import type { GlobExpansion, GlobRequest } from './globImports.ts'

function generatedImports(code: string, importer: string): string[] {
  const ast = ts.createSourceFile('glob.js', code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)
  return ast.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      ? [posix.join(posix.dirname(importer), statement.moduleSpecifier.text)]
      : [],
  )
}

export async function viteGlobCallTargets(
  root: string,
  importer: string,
  callCode: string,
  bundled = true,
): Promise<string[]> {
  const id = resolve(root, importer).replace(/\\/g, '/')
  let targets: string[] | undefined
  await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: 'silent',
    publicDir: false,
    plugins: [
      {
        name: 'glob-input',
        configResolved(config) {
          if (bundled) return
          // Select the JavaScript glob plugin while the remaining plugins
          // keep their build environment. This does not create a dev server.
          const glob = config.plugins.find((plugin) => plugin.name === 'vite:import-glob')
          if (glob === undefined) throw new Error('Vite has no glob plugin')
          glob.applyToEnvironment = () => true
        },
        load(loadedId) {
          if (loadedId === id) return `export const files = ${callCode}`
        },
      },
      {
        name: 'glob-output',
        enforce: 'post',
        transform(code, transformedId) {
          if (transformedId !== id) return
          targets = generatedImports(code, importer)
          return 'export const files = {}'
        },
      },
    ],
    build: { write: false, minify: false, rolldownOptions: { input: id } },
  })
  if (targets === undefined) throw new Error('Vite did not transform the glob')
  return targets
}

export function viteGlobTargets(
  root: string,
  importer: string,
  argumentsCode: string,
  bundled = true,
): Promise<string[]> {
  return viteGlobCallTargets(root, importer, `import.meta.glob(${argumentsCode})`, bundled)
}

export async function expandViteMode(
  root: string,
  importer: string,
  request: GlobRequest,
  bundled: boolean,
): Promise<GlobExpansion> {
  try {
    return {
      kind: 'targets',
      files: await viteGlobTargets(root, importer, request.argumentsCode, bundled),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      kind: 'problem',
      message: `${bundled ? 'Native' : 'JavaScript'} Vite glob cannot expand: ${detail}`,
    }
  }
}
