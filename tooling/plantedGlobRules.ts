// Each pattern-import violation has a clean counterpart under the same
// configuration, including the table's type-only and public-entry edges.
import { importAccess, layers } from './layers.ts'
import type { PlantedCase } from './plantedShapes.ts'
import { caseDirectory, sampleElements } from './plantedShapes.ts'

const RULE = 'source-policy/glob-targets'

function globCase(
  name: string,
  file: string,
  pattern: string,
  errors = 0,
  prelude = '',
): PlantedCase {
  return {
    title: `glob ${name}`,
    tree: errors === 0 ? 'clean' : 'violations',
    file,
    code: `${prelude}export const planted = import.meta.glob(${pattern}, { eager: true })\n`,
    expectedRuleIds: Array.from({ length: errors }, () => RULE),
  }
}

function matrixCases(): PlantedCase[] {
  return layers
    .filter((layer) => layer.artifact === 'module')
    .flatMap((from) =>
      layers.map((to) => {
        const target =
          to.elements === 'per-subfolder'
            ? `src/${to.folder}/${sampleElements[1]}/index.ts`
            : `src/${to.folder}/${to.artifact === 'stylesheet' ? 'global.css' : 'target.ts'}`
        const access = importAccess(from.name, to.name)
        return globCase(
          `edge ${from.name} to ${to.name}`,
          `${caseDirectory(from)}/glob-edge-${to.name}.ts`,
          `'/${target}'`,
          access === 'runtime' || access === 'entry-only' ? 0 : 1,
        )
      }),
    )
}

const probes: readonly PlantedCase[] = [
  globCase('forbidden cross-layer target', 'src/lib/glob-app.ts', "'/src/app/target.ts'", 1),
  {
    ...globCase(
      'root anchored from a subdirectory',
      'src/lib/glob-root.ts',
      "'/src/app/target.ts'",
      1,
    ),
    lintFrom: 'subdirectory',
  },
  globCase('allowed cross-layer test', 'src/app/glob-products.test.ts', "'../products/target.ts'"),
  globCase('same element', 'src/lib/glob-same.ts', "'./target.ts'"),
  globCase(
    'production fixture target',
    'src/lib/glob-fixture.ts',
    "'./planted-target.fixtures.ts'",
    1,
  ),
  globCase(
    'fixture importing fixture',
    'src/lib/glob-fixture.fixtures.ts',
    "'./planted-target.fixtures.ts'",
  ),
  globCase(
    'test importing fixture',
    'src/lib/glob-fixture.test.ts',
    "'./planted-target.fixtures.ts'",
  ),
  globCase(
    'fixture still obeys layers',
    'src/ui/glob-fixture-cross.fixtures.ts',
    "'/src/app/glob-support.fixtures.ts'",
    1,
  ),
  {
    title: 'glob fixture target support',
    tree: 'violations',
    file: 'src/app/glob-support.fixtures.ts',
    code: 'export const planted = 1\n',
    expectedRuleIds: [],
  },
  {
    title: 'glob outside fixture support',
    tree: 'clean',
    file: 'tests/fixtures/glob-support.fixtures.ts',
    code: 'export const planted = 1\n',
    expectedRuleIds: [],
  },
  {
    title: 'glob outside fixture violation support',
    tree: 'violations',
    file: 'tests/fixtures/glob-support.fixtures.ts',
    code: 'export const planted = 1\n',
    expectedRuleIds: [],
  },
  globCase('outside non-fixture target', 'src/lib/glob-outside.ts', "'/tooling/helper.ts'", 1),
  globCase(
    'outside fixture from test',
    'src/lib/glob-outside.test.ts',
    "'/tests/fixtures/glob-support.fixtures.ts'",
  ),
  globCase(
    'outside fixture from fixture',
    'src/lib/glob-outside.fixtures.ts',
    "'/tests/fixtures/glob-support.fixtures.ts'",
  ),
  globCase(
    'outside fixture from production',
    'src/lib/glob-outside-production.ts',
    "'/tests/fixtures/glob-support.fixtures.ts'",
    1,
  ),
  globCase(
    'non-literal pattern',
    'src/lib/glob-dynamic.ts',
    'pattern',
    1,
    "const pattern = './target.ts'\n",
  ),
  globCase('literal twin', 'src/lib/glob-literal.ts', "'./target.ts'"),
  globCase(
    'dynamic template',
    'src/lib/glob-template-dynamic.ts',
    '`./${name}.ts`',
    1,
    "const name = 'target'\n",
  ),
  globCase('static template', 'src/lib/glob-template.ts', '`./target.ts`'),
  globCase(
    'array with forbidden target',
    'src/lib/glob-array.ts',
    "['./target.ts', '/src/app/target.ts']",
    1,
  ),
  globCase(
    'array with non-literal element',
    'src/lib/glob-array-dynamic.ts',
    "['./target.ts', pattern]",
    1,
    "const pattern = './target.ts'\n",
  ),
  globCase('literal array', 'src/lib/glob-array-clean.ts', "['./target.ts', './one-way-b.ts']"),
  globCase(
    'negation removes forbidden target',
    'src/lib/glob-negation.ts',
    "['/src/{app,lib}/target.ts', '!/src/app/**']",
  ),
  globCase(
    'unexcluded forbidden target',
    'src/lib/glob-negation-bad.ts',
    "'/src/{app,lib}/target.ts'",
    1,
  ),
  globCase('zero matches', 'src/lib/glob-empty.ts', "'./glob-missing-*.ts'", 1),
  globCase('nonempty twin', 'src/lib/glob-nonempty.ts', "'./target.ts'"),
  globCase(
    'each forbidden target named',
    'src/lib/glob-two-targets.ts',
    "['/src/app/target.ts', '/src/ui/target.ts']",
    2,
  ),
  globCase(
    'two allowed targets',
    'src/app/glob-two-targets.ts',
    "['/src/lib/target.ts', '/src/ui/target.ts']",
  ),
  globCase(
    'public entry restriction',
    'src/app/glob-internal.ts',
    "'/src/features/element-b/internals.ts'",
    1,
  ),
  globCase('public entry twin', 'src/app/glob-entry.ts', "'/src/features/element-b/index.ts'"),
  globCase(
    'sibling internals restricted',
    'src/features/element-a/glob-sibling.ts',
    "'../element-b/internals.ts'",
    1,
  ),
  globCase('own feature internals', 'src/features/element-a/glob-own.ts', "'./internals.ts'"),
  globCase('runtime on type-only edge', 'src/products/glob-type.ts', "'/src/lib/target.ts'", 1),
  globCase('data same layer', 'src/products/glob-data.ts', "'./target.ts'"),
]

export function globCases(): PlantedCase[] {
  return [...matrixCases(), ...probes, ...expanderCases(), ...nonGlobCases()]
}

function nonGlobCases(): PlantedCase[] {
  return ['import.meta["glob"]', 'import.meta.glob?.', 'import.meta?.glob'].map(
    (callee, index) => ({
      title: `glob non-bundler call ${callee}`,
      tree: 'clean',
      file: `src/lib/glob-non-bundler-${index}.ts`,
      code: `export const planted = ${callee}('/src/app/target.ts', { eager: true })\n`,
      expectedRuleIds: [],
    }),
  )
}

function expanderCases(): PlantedCase[] {
  return ['javascript', 'native'].flatMap((expander) => {
    const target = expander === 'javascript' ? '.glob-target.ts' : '1..3.ts'
    const pattern = expander === 'javascript' ? '.glob-target.ts' : '{1..3}.ts'
    return [
      ...(['violations', 'clean'] as const).map((tree) => ({
        title: `glob ${expander} expander support ${tree}`,
        tree,
        file: `tests/glob-targets/${target}`,
        code: 'export const planted = 1\n',
        expectedRuleIds: [],
      })),
      globCase(
        `${expander} only expander forbidden target`,
        `src/lib/glob-${expander}-only.ts`,
        `['./target.ts', '/tests/glob-targets/${pattern}']`,
        1,
      ),
      globCase(
        `${expander} only expander excluded twin`,
        `src/lib/glob-${expander}-only.ts`,
        `['./target.ts', '/tests/glob-targets/${pattern}', '!/tests/**']`,
      ),
    ]
  })
}

// The existing suite already plants this single path. Separate trees keep
// these probes from replacing its explicit-import composition-root cases.
export function globCompositionCases(): PlantedCase[] {
  return [
    globCase('composition root forbidden', 'src/main.tsx', "'/src/lib/target.ts'", 1),
    globCase('composition root app', 'src/main.tsx', "'/src/app/target.ts'"),
  ]
}
