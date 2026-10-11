import { LAYERS_RULE, valueImportOf, type PlantedCase } from './plantedShapes.ts'

export function fixtureBudgetCases(): PlantedCase[] {
  return [
    {
      title: 'a source test importing the shared fixture budget',
      tree: 'clean',
      file: 'src/viewer/fixture-budget.test.ts',
      code: valueImportOf('TOOL_FIXTURE_TIMEOUT_MS', '../../tooling/subprocess.fixtures'),
      expectedRuleIds: [],
    },
    {
      title: 'production code cannot import the shared fixture budget',
      tree: 'violations',
      file: 'src/viewer/fixture-budget.ts',
      code: valueImportOf('TOOL_FIXTURE_TIMEOUT_MS', '../../tooling/subprocess.fixtures'),
      expectedRuleIds: [LAYERS_RULE, 'no-restricted-imports'],
    },
    {
      title: 'a source test cannot import arbitrary tooling',
      tree: 'violations',
      file: 'src/viewer/tooling-helper.test.ts',
      code: valueImportOf('helper', '../../tooling/helper'),
      expectedRuleIds: [LAYERS_RULE],
    },
  ]
}
