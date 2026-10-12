import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { expandGlobImports } from './globImports.ts'
import { createGlobFileTree } from './globFileTree.ts'
import { expandGatedGlob } from './globImportSource.ts'
import { globCall, globCalls } from './globImportProof.fixtures.ts'
import type { GlobExpansion } from './globImports.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

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

const targetCases = [
  ...["'./*.ts'", '`./*.ts`', "['./z.ts', './a.ts']"].map((pattern) => ({
    title: `expands the literal form ${pattern}, excluding self and sorting`,
    probes: [{ pattern, targets: ['src/lib/a.ts', 'src/lib/z.ts'] }],
  })),
  {
    title: 'resolves root paths and parent-relative paths',
    probes: [{ pattern: "['/src/app/*.ts', '../app/*.ts']", targets: ['src/app/a.ts'] }],
  },
  {
    title: 'applies negations independently of order and deduplicates',
    probes: [{ pattern: "['!./z.ts', './*.ts', './a.ts']", targets: ['src/lib/a.ts'] }],
  },
  {
    title: 'matches braces and globstars without including hidden or package files by default',
    probes: [{ pattern: "'./**/{a,b}.ts'", targets: ['src/lib/a.ts', 'src/lib/nested/b.ts'] }],
  },
  {
    title: 'exhaustive includes hidden files and package files',
    probes: [
      {
        pattern: "'./**/*.ts', { exhaustive: true }",
        targets: files.filter((file) => file.startsWith('src/lib/') && file !== importer).sort(),
      },
    ],
  },
  {
    title: 'an explicit hidden name matches without exhaustive',
    probes: [{ pattern: "'./.hidden.ts'", targets: ['src/lib/.hidden.ts'] }],
  },
  {
    title: 'a static package directory becomes the search root before ignores apply',
    probes: [
      { pattern: "'./node_modules/package/*.ts'", targets: ['src/lib/node_modules/package/a.ts'] },
    ],
  },
  {
    title: 'case sensitivity is explicit and defaults to sensitive',
    probes: [
      { pattern: "'./A.ts'", targets: [] },
      { pattern: "'./A.ts', { caseSensitive: false }", targets: ['src/lib/a.ts'] },
    ],
  },
  {
    title: 'resolves a literal base option',
    probes: [
      { pattern: "'./*.ts', { base: '/src/app' }", targets: ['src/app/a.ts'] },
      { pattern: "'./*.ts', { base: '../app' }", targets: ['src/app/a.ts'] },
    ],
  },
  {
    title: 'accepts an empty literal array as a zero-file expansion',
    probes: [{ pattern: '[]', targets: [] }],
  },
]
const problemCases = [
  { title: 'does not expand a directory name into its descendants', pattern: "'./nested'" },
  ...[
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
  ].map((pattern) => ({ title: `fails closed for ${pattern}`, pattern })),
]

let tree: ReturnType<typeof createGlobFileTree>
const expansions = new Map<string, GlobExpansion>()
beforeAll(async () => {
  tree = createGlobFileTree(resolve(import.meta.dirname, '..'), files)
  const patterns = [
    ...targetCases.flatMap((probe) => probe.probes.map((item) => item.pattern)),
    ...problemCases.map((probe) => probe.pattern),
  ]
  for (const pattern of patterns) {
    expansions.set(pattern, await expandGatedGlob(tree.root, globCall(pattern), importer, files))
  }
}, TOOL_FIXTURE_TIMEOUT_MS)
afterAll(() => tree.remove())

describe('glob import expansion', () => {
  for (const { title, probes } of targetCases) {
    it(title, () => {
      for (const { pattern, targets } of probes) {
        expect(expansions.get(pattern)).toEqual({ kind: 'targets', files: targets })
      }
    })
  }
  for (const { title, pattern } of problemCases) {
    it(title, () => {
      expect(expansions.get(pattern)?.kind).toBe('problem')
    })
  }

  it('comments, other receivers, dynamic imports and new URL are not glob calls', () => {
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
