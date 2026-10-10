import { ESLint } from 'eslint'
import { relative, resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { createConfig } from './eslintConfig.ts'
import { plantAndLintCases } from './lintSuite.ts'
import type { PlantedSuite } from './lintSuite.ts'
import { globCases, globCompositionCases } from './plantedGlobRules.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const root = resolve(import.meta.dirname, '..')
let suite: PlantedSuite
let realResults: Map<string, ESLint.LintResult>
const realImporters = [
  'src/products/index.ts',
  'src/app/productsIndex.test.ts',
  'src/app/product-harness/main.fixtures.tsx',
]
const cases = [
  ...globCompositionCases(),
  ...globCases().filter(
    (probe) =>
      probe.file === 'src/lib/glob-two-targets.ts' ||
      probe.title.includes('only expander') ||
      probe.title.includes('expander support'),
  ),
]

beforeAll(async () => {
  suite = await plantAndLintCases(cases)
}, TOOL_FIXTURE_TIMEOUT_MS)

beforeAll(async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: await createConfig({ root }),
  })
  const results = await eslint.lintFiles(realImporters)
  realResults = new Map(
    results.map((result) => [relative(root, result.filePath).replace(/\\/g, '/'), result]),
  )
}, TOOL_FIXTURE_TIMEOUT_MS)

for (const importer of realImporters) {
  it(`${importer} retains its clean real glob`, () => {
    const result = realResults.get(importer)
    expect(result, `${importer} was linted`).toBeDefined()
    expect(result?.messages).toEqual([])
  })
}

it('glob composition roots retain their explicit-import policy', () => {
  for (const probe of globCompositionCases()) {
    const messages = suite[probe.tree].get(probe.file)
    expect(messages).toBeDefined()
    expect(messages?.map((message) => message.ruleId)).toEqual(probe.expectedRuleIds)
  }
})

it('glob findings name every offending target', () => {
  const messages = suite.violations.get('src/lib/glob-two-targets.ts')
  expect(messages?.map((message) => message.ruleId)).toEqual([
    'source-policy/glob-targets',
    'source-policy/glob-targets',
  ])
  expect(messages?.[0]?.message).toContain('src/app/target.ts')
  expect(messages?.[1]?.message).toContain('src/ui/target.ts')
})

for (const [expander, target] of [
  ['javascript', '.glob-target.ts'],
  ['native', '1..3.ts'],
]) {
  it(`the ${expander} only target is reported by path, with an allowed target also present`, () => {
    const messages = suite.violations.get(`src/lib/glob-${expander}-only.ts`)
    expect(messages).toHaveLength(1)
    expect(messages?.[0]?.ruleId).toBe('source-policy/glob-targets')
    expect(messages?.[0]?.message).toContain(
      `Glob target "tests/glob-targets/${target}" is forbidden`,
    )
    expect(suite.clean.get(`src/lib/glob-${expander}-only.ts`)).toEqual([])
  })
}
