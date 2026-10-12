// Reduced motion probes: the media query of the preference is spelled only
// in its owner module. Every spelling of the feature is planted as a
// violation (plain, spaced, in another case, in a template literal, alone,
// in a JSX attribute); the neighboring features, a longer feature name, a
// comment that names the feature, and the owner module with its test stay
// clean, which pins the rule to the exact feature name and the exact owner
// paths.
import { reducedMotionOwners } from './reducedMotionRule.ts'
import type { PlantedCase } from './plantedShapes.ts'

const RULE = 'source-policy/reduced-motion-query'

type Spelling = { readonly title: string; readonly code: string }

function constant(value: string): string {
  return `export const planted = ${value}\n`
}

const violations: readonly Spelling[] = [
  { title: 'the query as a string literal', code: constant(`'(prefers-reduced-motion: reduce)'`) },
  {
    title: 'the query with spaces around its parts',
    code: constant(`'( prefers-reduced-motion : reduce )'`),
  },
  { title: 'the query in upper case', code: constant(`'(PREFERS-REDUCED-MOTION: REDUCE)'`) },
  {
    title: 'the query in a template literal',
    code: "const value = 'reduce'\nexport const planted = `(prefers-reduced-motion: ${value})`\n",
  },
  { title: 'the feature name alone', code: constant(`'prefers-reduced-motion'`) },
]

const cleanSpellings: readonly Spelling[] = [
  { title: 'the reduced data feature', code: constant(`'(prefers-reduced-data: reduce)'`) },
  {
    title: 'the reduced transparency feature',
    code: constant(`'(prefers-reduced-transparency: reduce)'`),
  },
  {
    title: 'a longer feature name that starts with the same words',
    code: constant(`'(prefers-reduced-motion-extra: reduce)'`),
  },
  {
    title: 'a comment that names the feature',
    code: '// Reads prefers-reduced-motion through its owner.\nexport const planted = 1\n',
  },
]

export function reducedMotionCases(): PlantedCase[] {
  return [
    ...violations.map(({ title, code }, index): PlantedCase => ({
      title: `a source spelling ${title}`,
      tree: 'violations',
      file: `src/lib/spells-reduced-motion-${index}.ts`,
      code,
      expectedRuleIds: [RULE],
    })),
    {
      title: 'a component spelling the query in a JSX attribute',
      tree: 'violations',
      file: 'src/ui/spells-reduced-motion-attribute.tsx',
      code: 'export function Planted() {\n  return <source media="(prefers-reduced-motion: reduce)" />\n}\n',
      expectedRuleIds: [RULE],
    },
    ...cleanSpellings.map(({ title, code }, index): PlantedCase => ({
      title: `a source spelling ${title}`,
      tree: 'clean',
      file: `src/lib/spells-other-feature-${index}.ts`,
      code,
      expectedRuleIds: [],
    })),
    ...reducedMotionOwners.map((file): PlantedCase => ({
      title: `the owner ${file} spelling the query`,
      tree: 'clean',
      file,
      code: constant(`'(prefers-reduced-motion: reduce)'`),
      expectedRuleIds: [],
    })),
  ]
}
