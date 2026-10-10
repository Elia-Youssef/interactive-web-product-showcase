import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listGatedFiles } from './gatedFiles.ts'
import { createGlobFileTree } from './globFileTree.ts'
import { createGlobImportSource, expandGatedGlob } from './globImportSource.ts'
import { globImportKey } from './globImports.ts'
import type { GlobExpansion } from './globImports.ts'
import { globCall, globCalls, viteGlobTargets } from './globImportProof.fixtures.ts'
import { viteGlobCallTargets } from './globExpanders.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const root = resolve(import.meta.dirname, '..')
const realImporters = [
  'src/products/index.ts',
  'src/app/productsIndex.test.ts',
  'src/app/product-harness/main.fixtures.tsx',
]
type ExpansionEvidence = {
  native: string[]
  javascript: string[]
  actual: GlobExpansion
}

describe('real glob expansions', () => {
  let files: string[]
  let tree: ReturnType<typeof createGlobFileTree>
  beforeAll(() => {
    files = listGatedFiles(root)
    tree = createGlobFileTree(root, files)
  }, TOOL_FIXTURE_TIMEOUT_MS)
  afterAll(() => tree.remove())
  for (const importer of realImporters) {
    describe(importer, () => {
      let calls: ReturnType<typeof globCalls>
      let evidence: ExpansionEvidence
      beforeAll(async () => {
        const source = readFileSync(join(root, importer), 'utf8')
        calls = globCalls(source, importer)
        const call = calls[0]
        if (call === undefined) throw new Error('missing real glob call')
        const range = call.arguments[0]?.range
        if (range === undefined) throw new Error('missing pattern source range')
        const argumentsCode = `${source.slice(range[0], range[1])}, { eager: true }`
        evidence = {
          native: await viteGlobTargets(root, importer, argumentsCode),
          javascript: await viteGlobTargets(root, importer, argumentsCode, false),
          actual: await expandGatedGlob(tree.root, call, importer, files),
        }
      }, TOOL_FIXTURE_TIMEOUT_MS)
      it(`${importer} agrees with both installed Vite expanders`, () => {
        expect(calls).toHaveLength(1)
        expect(evidence.native.length).toBeGreaterThan(0)
        expect(evidence.javascript).toEqual(evidence.native)
        expect(evidence.actual).toEqual({ kind: 'targets', files: evidence.native })
      })
    })
  }
  it('the pipeline comment is not a call', () => {
    expect(globCalls(readFileSync(join(root, 'scripts/productPaths.ts'), 'utf8'))).toEqual([])
  })
})

describe('installed Vite expansion semantics', () => {
  const importer = 'src/lib/importer.ts'
  const files = [
    importer,
    'src/lib/z.ts',
    'src/lib/a.ts',
    'src/lib/.hidden.ts',
    'src/lib/nested/b.ts',
    'src/lib/node_modules/package/a.ts',
    'src/lib/+(a).ts',
    'src/lib/1..3.ts',
  ]
  const patterns = [
    "'./*.ts'",
    '`./*.ts`',
    "['./*.ts', '!./z.ts']",
    "'./**/{a,b}.ts'",
    "'./**/*.ts', { exhaustive: true, eager: true }",
    "'./+(a).ts'",
    "'./node_modules/package/*.ts'",
    "'./A.ts', { caseSensitive: false, eager: true }",
    "'./missing-*.ts'",
    "'./*.ts', { base: './nested', eager: true }",
  ]
  const callees = ['import.meta["glob"]', 'import.meta.glob?.', 'import.meta?.glob']
  const expansions = new Map<string, ExpansionEvidence>()
  const alternateCalls = new Map<string, { native: string[]; javascript: string[] }>()
  let tree: ReturnType<typeof createGlobFileTree>
  let directoryRun: PromiseSettledResult<string[]>
  let directoryExpansion: GlobExpansion
  beforeAll(async () => {
    tree = createGlobFileTree(root, files)
    for (const pattern of [
      "'./.hidden.ts', { eager: true }",
      "'./{1..3}.ts', { eager: true }",
      ...patterns,
    ]) {
      const argumentsCode = pattern.includes('eager: true')
        ? pattern
        : `${pattern}, { eager: true }`
      expansions.set(pattern, {
        javascript: await viteGlobTargets(tree.root, importer, argumentsCode, false),
        native: await viteGlobTargets(tree.root, importer, argumentsCode, true),
        actual: await expandGatedGlob(tree.root, globCall(argumentsCode), importer, files),
      })
    }
    for (const callee of callees) {
      const code = `${callee}('./a.ts', { eager: true })`
      alternateCalls.set(callee, {
        javascript: await viteGlobCallTargets(tree.root, importer, code, false),
        native: await viteGlobCallTargets(tree.root, importer, code, true),
      })
    }
    const pattern = "'./nested', { eager: true }"
    const [run] = await Promise.allSettled([viteGlobTargets(tree.root, importer, pattern, false)])
    if (run === undefined) throw new Error('missing directory expansion result')
    directoryRun = run
    directoryExpansion = await expandGatedGlob(tree.root, globCall(pattern), importer, files)
  }, TOOL_FIXTURE_TIMEOUT_MS)
  afterAll(() => tree.remove())

  it('pins the explicit hidden-file disagreement and checks its union', () => {
    const pattern = "'./.hidden.ts', { eager: true }"
    const evidence = expansions.get(pattern)
    expect(evidence?.native).toEqual([])
    expect(evidence?.javascript).toEqual(['src/lib/.hidden.ts'])
    expect(evidence?.actual).toEqual({
      kind: 'targets',
      files: ['src/lib/.hidden.ts'],
    })
  })

  for (const callee of callees) {
    it(`neither Vite expander handles ${callee} and detection leaves it alone`, () => {
      const code = `${callee}('./a.ts', { eager: true })`
      expect(alternateCalls.get(callee)?.javascript).toEqual([])
      expect(alternateCalls.get(callee)?.native).toEqual([])
      expect(globCalls(code)).toEqual([])
    })
  }

  it('includes a target reached only by the native range interpretation', () => {
    const pattern = "'./{1..3}.ts', { eager: true }"
    const evidence = expansions.get(pattern)
    expect(evidence?.javascript).toEqual([])
    expect(evidence?.native).toEqual(['src/lib/1..3.ts'])
    expect(evidence?.actual).toEqual({
      kind: 'targets',
      files: ['src/lib/1..3.ts'],
    })
  })

  it('reports the error if either Vite expander cannot expand a search directory', () => {
    expect(() => {
      if (directoryRun.status === 'rejected') throw directoryRun.reason
    }).toThrow('non-empty string')
    expect(directoryExpansion).toMatchObject({
      kind: 'problem',
      message: expect.stringContaining('JavaScript Vite glob cannot expand'),
    })
  })

  for (const pattern of patterns) {
    it(`pins matching and ordering for ${pattern}`, () => {
      const evidence = expansions.get(pattern)
      if (evidence === undefined) throw new Error(`missing expansion evidence for ${pattern}`)
      expect(evidence.actual).toEqual({
        kind: 'targets',
        files: [...new Set([...evidence.javascript, ...evidence.native])].sort(),
      })
    })
  }
})

it('the namespace rejects paths outside the supplied root', () => {
  expect(() => createGlobFileTree(root, ['../outside.ts'])).toThrow('outside its namespace')
})

describe('gated filename authority', () => {
  const importer = 'src/lib/importer.ts'
  const owned = [importer, 'src/lib/allowed.ts']
  const all = [...owned, 'src/app/unowned.ts']
  let ownedExpansion: GlobExpansion | undefined
  let allExpansion: GlobExpansion | undefined
  beforeAll(async () => {
    const tree = createGlobFileTree(root, all)
    const code = "export const files = import.meta.glob(['/src/lib/allowed.ts', '/src/app/*.ts'])"
    writeFileSync(join(tree.root, importer), code)
    try {
      const call = globCalls(code, importer)[0]
      if (call === undefined) throw new Error('missing authority probe')
      const key = globImportKey(importer, call)
      ownedExpansion = (await createGlobImportSource(tree.root, owned)).get(key)
      allExpansion = (await createGlobImportSource(tree.root, all)).get(key)
    } finally {
      tree.remove()
    }
  }, TOOL_FIXTURE_TIMEOUT_MS)
  it('gated filenames are the authority even when an adjacent unowned target exists', () => {
    expect(ownedExpansion).toEqual({
      kind: 'targets',
      files: ['src/lib/allowed.ts'],
    })
    expect(allExpansion).toEqual({
      kind: 'targets',
      files: ['src/app/unowned.ts', 'src/lib/allowed.ts'],
    })
  })
})
