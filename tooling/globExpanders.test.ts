import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listGatedFiles } from './gatedFiles.ts'
import { createGlobFileTree } from './globFileTree.ts'
import { createGlobImportSource, expandGatedGlob } from './globImportSource.ts'
import { globImportKey } from './globImports.ts'
import { globCall, globCalls, viteGlobTargets } from './globImportProof.fixtures.ts'
import { viteGlobCallTargets } from './globExpanders.ts'

const root = resolve(import.meta.dirname, '..')
const realImporters = [
  'src/products/index.ts',
  'src/app/productsIndex.test.ts',
  'src/app/product-harness/main.fixtures.tsx',
]

describe('real glob expansions', () => {
  const files = listGatedFiles(root)
  let tree: ReturnType<typeof createGlobFileTree>
  beforeAll(() => {
    tree = createGlobFileTree(root, files)
  })
  afterAll(() => tree.remove())
  for (const importer of realImporters) {
    it(`${importer} agrees with both installed Vite expanders`, async () => {
      const source = readFileSync(join(root, importer), 'utf8')
      const calls = globCalls(source, importer)
      expect(calls).toHaveLength(1)
      const call = calls[0]
      if (call === undefined) throw new Error('missing real glob call')
      const range = call.arguments[0]?.range
      if (range === undefined) throw new Error('missing pattern source range')
      const argumentsCode = `${source.slice(range[0], range[1])}, { eager: true }`
      const native = await viteGlobTargets(root, importer, argumentsCode)
      const javascript = await viteGlobTargets(root, importer, argumentsCode, false)
      expect(native.length).toBeGreaterThan(0)
      expect(javascript).toEqual(native)
      expect(await expandGatedGlob(tree.root, call, importer, files)).toEqual({
        kind: 'targets',
        files: native,
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
  let tree: ReturnType<typeof createGlobFileTree>
  beforeAll(() => {
    tree = createGlobFileTree(root, files)
  })
  afterAll(() => tree.remove())

  it('pins the explicit hidden-file disagreement and checks its union', async () => {
    const pattern = "'./.hidden.ts', { eager: true }"
    expect(await viteGlobTargets(tree.root, importer, pattern, true)).toEqual([])
    expect(await viteGlobTargets(tree.root, importer, pattern, false)).toEqual([
      'src/lib/.hidden.ts',
    ])
    expect(await expandGatedGlob(tree.root, globCall(pattern), importer, files)).toEqual({
      kind: 'targets',
      files: ['src/lib/.hidden.ts'],
    })
  })

  for (const callee of ['import.meta["glob"]', 'import.meta.glob?.', 'import.meta?.glob']) {
    it(`neither Vite expander handles ${callee} and detection leaves it alone`, async () => {
      const code = `${callee}('./a.ts', { eager: true })`
      expect(await viteGlobCallTargets(tree.root, importer, code, false)).toEqual([])
      expect(await viteGlobCallTargets(tree.root, importer, code, true)).toEqual([])
      expect(globCalls(code)).toEqual([])
    })
  }

  it('includes a target reached only by the native range interpretation', async () => {
    const pattern = "'./{1..3}.ts', { eager: true }"
    expect(await viteGlobTargets(tree.root, importer, pattern, false)).toEqual([])
    expect(await viteGlobTargets(tree.root, importer, pattern, true)).toEqual(['src/lib/1..3.ts'])
    expect(await expandGatedGlob(tree.root, globCall(pattern), importer, files)).toEqual({
      kind: 'targets',
      files: ['src/lib/1..3.ts'],
    })
  })

  it('reports the error if either Vite expander cannot expand a search directory', async () => {
    const pattern = "'./nested', { eager: true }"
    await expect(viteGlobTargets(tree.root, importer, pattern, false)).rejects.toThrow(
      'non-empty string',
    )
    expect(await expandGatedGlob(tree.root, globCall(pattern), importer, files)).toMatchObject({
      kind: 'problem',
      message: expect.stringContaining('JavaScript Vite glob cannot expand'),
    })
  })

  for (const pattern of [
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
  ]) {
    it(`pins matching and ordering for ${pattern}`, async () => {
      const argumentsCode = pattern.includes('eager: true')
        ? pattern
        : `${pattern}, { eager: true }`
      const javascript = await viteGlobTargets(tree.root, importer, argumentsCode, false)
      const native = await viteGlobTargets(tree.root, importer, argumentsCode, true)
      expect(await expandGatedGlob(tree.root, globCall(argumentsCode), importer, files)).toEqual({
        kind: 'targets',
        files: [...new Set([...javascript, ...native])].sort(),
      })
    })
  }
})

it('the namespace rejects paths outside the supplied root', () => {
  expect(() => createGlobFileTree(root, ['../outside.ts'])).toThrow('outside its namespace')
})

it('gated filenames are the authority even when an adjacent unowned target exists', async () => {
  const importer = 'src/lib/importer.ts'
  const owned = [importer, 'src/lib/allowed.ts']
  const all = [...owned, 'src/app/unowned.ts']
  const tree = createGlobFileTree(root, all)
  const code = "export const files = import.meta.glob(['/src/lib/allowed.ts', '/src/app/*.ts'])"
  writeFileSync(join(tree.root, importer), code)
  try {
    const call = globCalls(code, importer)[0]
    if (call === undefined) throw new Error('missing authority probe')
    const key = globImportKey(importer, call)
    expect((await createGlobImportSource(tree.root, owned)).get(key)).toEqual({
      kind: 'targets',
      files: ['src/lib/allowed.ts'],
    })
    expect((await createGlobImportSource(tree.root, all)).get(key)).toEqual({
      kind: 'targets',
      files: ['src/app/unowned.ts', 'src/lib/allowed.ts'],
    })
  } finally {
    tree.remove()
  }
})
