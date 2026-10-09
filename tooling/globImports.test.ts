import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { expandGlobImports } from './globImports.ts'
import { createGlobFileTree } from './globFileTree.ts'
import { expandGatedGlob } from './globImportSource.ts'
import { globCall, globCalls } from './globImportProof.fixtures.ts'

const importer = 'src/lib/importer.ts'
const files = [
  'src/lib/z.ts',
  'src/lib/a.ts',
  'src/lib/.hidden.ts',
  'src/lib/importer.ts',
  'src/app/a.ts',
  'src/lib/nested/b.ts',
  'src/lib/node_modules/package/a.ts',
]

let tree: ReturnType<typeof createGlobFileTree>
beforeAll(() => {
  tree = createGlobFileTree(resolve(import.meta.dirname, '..'), files)
})
afterAll(() => tree.remove())

function expand(argumentsCode: string) {
  return expandGatedGlob(tree.root, globCall(argumentsCode), importer, files)
}

describe('glob import expansion', () => {
  for (const pattern of ["'./*.ts'", '`./*.ts`', "['./z.ts', './a.ts']"]) {
    it(`expands the literal form ${pattern}, excluding self and sorting`, async () => {
      expect(await expand(pattern)).toEqual({
        kind: 'targets',
        files: ['src/lib/a.ts', 'src/lib/z.ts'],
      })
    })
  }

  it('resolves root paths and parent-relative paths', async () => {
    expect(await expand("['/src/app/*.ts', '../app/*.ts']")).toEqual({
      kind: 'targets',
      files: ['src/app/a.ts'],
    })
  })

  it('applies negations independently of order and deduplicates', async () => {
    expect(await expand("['!./z.ts', './*.ts', './a.ts']")).toEqual({
      kind: 'targets',
      files: ['src/lib/a.ts'],
    })
  })

  it('matches braces and globstars without including hidden or package files by default', async () => {
    expect(await expand("'./**/{a,b}.ts'")).toEqual({
      kind: 'targets',
      files: ['src/lib/a.ts', 'src/lib/nested/b.ts'],
    })
  })

  it('exhaustive includes hidden files and package files', async () => {
    expect(await expand("'./**/*.ts', { exhaustive: true }")).toEqual({
      kind: 'targets',
      files: files.filter((file) => file.startsWith('src/lib/') && file !== importer).sort(),
    })
  })

  it('an explicit hidden name matches without exhaustive', async () => {
    expect(await expand("'./.hidden.ts'")).toEqual({
      kind: 'targets',
      files: ['src/lib/.hidden.ts'],
    })
  })

  it('a static package directory becomes the search root before ignores apply', async () => {
    expect(await expand("'./node_modules/package/*.ts'")).toEqual({
      kind: 'targets',
      files: ['src/lib/node_modules/package/a.ts'],
    })
  })

  it('case sensitivity is explicit and defaults to sensitive', async () => {
    expect(await expand("'./A.ts'")).toEqual({ kind: 'targets', files: [] })
    expect(await expand("'./A.ts', { caseSensitive: false }")).toEqual({
      kind: 'targets',
      files: ['src/lib/a.ts'],
    })
  })

  it('resolves a literal base option', async () => {
    expect(await expand("'./*.ts', { base: '/src/app' }")).toEqual({
      kind: 'targets',
      files: ['src/app/a.ts'],
    })
    expect(await expand("'./*.ts', { base: '../app' }")).toEqual({
      kind: 'targets',
      files: ['src/app/a.ts'],
    })
  })

  it('does not expand a directory name into its descendants', async () => {
    expect((await expand("'./nested'")).kind).toBe('problem')
  })

  for (const pattern of [
    'pattern',
    '`./${name}.ts`',
    '123',
    "['./a.ts', pattern]",
    "['./a.ts', ...patterns]",
    '[,]',
    "'alias/*.ts'",
    "'./*.ts', options",
    "'./*.ts', { exhaustive: exhaustive }",
    "'./*.ts', { ...options }",
  ]) {
    it(`fails closed for ${pattern}`, async () => {
      expect((await expand(pattern)).kind).toBe('problem')
    })
  }

  it('accepts an empty literal array as a zero-file expansion', async () => {
    expect(await expand('[]')).toEqual({ kind: 'targets', files: [] })
  })

  it('comments, other receivers, dynamic imports and new URL are not glob calls', async () => {
    expect(
      globCalls(
        "// import.meta.glob('./*.ts')\nconst files = other.glob('./*.ts'); import(pattern); new URL(pattern, import.meta.url)",
      ),
    ).toEqual([])
  })
})

describe('pure target union', () => {
  const call = globCall("'./*.ts'")
  it('includes either mode, deduplicates, sorts and excludes self and unowned files', () => {
    expect(
      expandGlobImports(call, importer, files, {
        javascript: { kind: 'targets', files: [importer, 'ignored.ts', 'src/lib/z.ts'] },
        native: { kind: 'targets', files: ['src/lib/a.ts', 'src/lib/z.ts'] },
      }),
    ).toEqual({ kind: 'targets', files: ['src/lib/a.ts', 'src/lib/z.ts'] })
  })
  for (const mode of ['javascript', 'native'] as const) {
    it(`preserves a typed failure from ${mode}`, () => {
      const problem = { kind: 'problem', message: 'expansion failed' } as const
      expect(
        expandGlobImports(call, importer, files, {
          javascript: { kind: 'targets', files: [] },
          native: { kind: 'targets', files: [] },
          [mode]: problem,
        }),
      ).toEqual(problem)
    })
  }
})
