// Import probes: cycles, banned packages, the externals policy, the script
// extensions allowed under src/, the styles row, and the two ways an import
// used to escape the gate: a target outside the layer graph, and an
// alias-shaped specifier that resolves to nothing.
import { layerByName, layers } from './layers.ts'
import {
  LAYERS_RULE,
  caseDirectory,
  sideEffectImport,
  slug,
  valueImport,
  valueImportOf,
} from './plantedShapes.ts'
import type { PlantedCase } from './plantedShapes.ts'

export function cycleCases(): PlantedCase[] {
  return [
    {
      title: 'a two-file import cycle',
      tree: 'violations',
      file: 'src/lib/cycle-a.ts',
      code: valueImport('./cycle-b'),
      expectedRuleIds: ['import-x/no-cycle'],
    },
    {
      title: 'a two-file import cycle through the tsx source extension',
      tree: 'violations',
      file: 'src/ui/cycle-tsx-a.tsx',
      code: valueImport('./cycle-tsx-b'),
      expectedRuleIds: ['import-x/no-cycle'],
    },
    {
      title: 'a one-way import stays quiet on cycles',
      tree: 'clean',
      file: 'src/lib/one-way-a.ts',
      code: valueImport('./one-way-b'),
      expectedRuleIds: [],
    },
  ]
}

export function externalsCases(): PlantedCase[] {
  return [
    {
      title: 'a declared package outside the layer bans',
      tree: 'clean',
      file: 'src/lib/uses-zod.ts',
      code: valueImportOf('z', 'zod'),
      expectedRuleIds: [],
    },
    {
      title: 'the data-only layer importing an external package',
      tree: 'violations',
      file: `${caseDirectory(layerByName.products)}/uses-three.ts`,
      code: `import * as planted from 'three'\nexport const usesPlanted = planted\n`,
      expectedRuleIds: [LAYERS_RULE],
    },
  ]
}

export function devDependencyCases(): PlantedCase[] {
  return [
    {
      title: 'a dev dependency imported from production code',
      tree: 'violations',
      file: 'src/lib/uses-vitest.ts',
      code: valueImportOf('expect', 'vitest'),
      expectedRuleIds: [LAYERS_RULE],
    },
    {
      title: 'a dev dependency imported from a test file',
      tree: 'clean',
      file: 'src/lib/uses-vitest.test.ts',
      code: valueImportOf('expect', 'vitest'),
      expectedRuleIds: [],
    },
    {
      title: 'a runtime package imported from a test file',
      tree: 'clean',
      file: 'src/lib/uses-zod.test.ts',
      code: valueImportOf('z', 'zod'),
      expectedRuleIds: [],
    },
    {
      title: 'a type-only dev import from production code',
      tree: 'violations',
      file: 'src/lib/uses-vitest-type.ts',
      code: `import type { Mock } from 'vitest'\nexport const planted: Mock = () => undefined\n`,
      expectedRuleIds: [LAYERS_RULE],
    },
  ]
}

export function foreignScriptCases(): PlantedCase[] {
  return [
    {
      title: 'a script extension that is no source extension under src/',
      tree: 'violations',
      file: 'src/ui/foreign-extension.mts',
      code: valueImport('@store/target'),
      expectedRuleIds: [LAYERS_RULE, 'source-policy/known-source-extension'],
    },
    {
      title: 'a plain js file under src/',
      tree: 'violations',
      file: 'src/ui/foreign-script.js',
      code: valueImport('../store/target'),
      expectedRuleIds: [LAYERS_RULE, 'source-policy/known-source-extension'],
    },
  ]
}

export function stylesCases(): PlantedCase[] {
  return [
    {
      title: 'a layer that never imports styles importing them',
      tree: 'violations',
      file: 'src/lib/uses-styles.ts',
      code: sideEffectImport('@styles/global.css'),
      expectedRuleIds: [LAYERS_RULE],
    },
    {
      title: 'a component layer importing styles',
      tree: 'clean',
      file: 'src/ui/uses-styles.ts',
      code: sideEffectImport('@styles/global.css'),
      expectedRuleIds: [],
    },
  ]
}

export function escapeCases(): PlantedCase[] {
  return [
    {
      title: 'an import escaping src/ into a folder outside the layer graph',
      tree: 'violations',
      file: 'src/lib/uses-tooling.ts',
      code: valueImportOf('helper', '../../tooling/helper.ts'),
      expectedRuleIds: [LAYERS_RULE, 'import-x/extensions'],
    },
    {
      title: 'an alias-shaped specifier that resolves to nothing',
      tree: 'violations',
      file: 'src/ui/uses-missing-alias.ts',
      code: valueImport('@store/missing'),
      expectedRuleIds: [LAYERS_RULE],
    },
  ]
}

export function extensionCases(): PlantedCase[] {
  return [
    {
      title: 'an import carrying a script extension inside src/',
      tree: 'violations',
      file: 'src/app/extensioned-import.ts',
      code: valueImport('./target.ts'),
      expectedRuleIds: ['import-x/extensions'],
    },
    {
      title: 'an extensionless relative import inside src/',
      tree: 'clean',
      file: 'src/app/extensionless-import.ts',
      code: valueImport('./target'),
      expectedRuleIds: [],
    },
  ]
}

export function bannedPackageCases(): PlantedCase[] {
  const cases: PlantedCase[] = []
  for (const layer of layers) {
    for (const ban of layer.bannedPackages ?? []) {
      cases.push({
        title: `${layer.name} importing ${ban.pattern}`,
        tree: 'violations',
        file: `${caseDirectory(layer)}/uses-${slug(ban.sample)}.ts`,
        code: `import * as planted from '${ban.sample}'\nexport const usesPlanted = planted\n`,
        expectedRuleIds: [LAYERS_RULE],
      })
    }
  }
  return cases
}
