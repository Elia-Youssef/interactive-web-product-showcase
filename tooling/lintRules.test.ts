// Proves the lint configuration itself: every case comes from the single
// planted-case list in lintSuite.ts, and this test only iterates it. Each case
// must be reported by exactly its expected rule ids, as errors, with nothing
// else on the file; a case with no expected rule ids must lint clean.
import { beforeAll, describe, expect, it } from 'vitest'
import { buildPlantedCases, plantAndLintCases } from './lintSuite.ts'
import type { PlantedSuite } from './lintSuite.ts'
import type { PlantedCase } from './lintSuite.ts'
import type { LintReport } from './lintTree.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const cases = buildPlantedCases()

let suite: PlantedSuite

beforeAll(async () => {
  suite = await plantAndLintCases(cases)
}, TOOL_FIXTURE_TIMEOUT_MS)

function reportFor(plantedCase: PlantedCase): LintReport {
  if (plantedCase.lintFrom === 'subdirectory') {
    if (suite.violationsFromSubdirectory === undefined) {
      throw new Error('the suite did not run the subdirectory lint this case needs')
    }
    return suite.violationsFromSubdirectory
  }
  return plantedCase.tree === 'violations' ? suite.violations : suite.clean
}

function expectCase(report: LintReport, plantedCase: PlantedCase): void {
  const messages = report.get(plantedCase.file)
  expect(messages, `${plantedCase.file} was linted`).toBeDefined()
  const actual = (messages ?? []).map((message) => message.ruleId).sort()
  expect(actual, plantedCase.title).toEqual([...plantedCase.expectedRuleIds].sort())
  for (const message of messages ?? []) {
    expect(message.severity, `${plantedCase.title}: ${message.ruleId} must be an error`).toBe(2)
  }
}

describe('the planted lint rule suite', () => {
  for (const plantedCase of cases) {
    it(plantedCase.title, () => {
      expectCase(reportFor(plantedCase), plantedCase)
    })
  }
})
