// The contract's rule table: one entry per rule of the authoring contract
// whose proof lives in the shipped bytes, each carrying a self-describing
// key naming what it checks, the report group its violations fold into,
// and a pure check over the validate step's facts. The entries are the
// only place a rule's key, group and check meet; validate runs the whole
// table and merges each entry's messages into its group's report, prefixed with the rule's
// key so a violation names the rule it breaks.

import type { Product } from '../src/lib/product/index.ts'
import type { ProductStructure } from './structure.ts'
import type { ContractModelFacts } from './contractFacts.ts'
import type { CameraContract } from './manifestIo.ts'
import { checkResult, type CheckResult } from './validateChecks.ts'
import { modelRules } from './contractRuleModel.ts'
import { geometryRules } from './contractRuleGeometry.ts'
import { materialRules } from './contractRuleMaterials.ts'
import { finishRules } from './contractRuleFinishes.ts'
import { cameraRules } from './contractRuleCameras.ts'
import { explodeRules } from './contractRuleExplode.ts'

// The report groups the table's rules fold into, the groups the validate
// step already prints.
export type ContractRuleGroup =
  'model' | 'cameras' | 'geometry' | 'finishes' | 'materials' | 'explode'

// What one rule check reads: the parsed manifest, the structure facts, the
// contract facts, and the camera contract assembly bridge.
export type ContractRuleInput = {
  readonly manifest: Product
  readonly structure: ProductStructure
  readonly facts: ContractModelFacts
  readonly contract: CameraContract
}

// One rule's messages: violations fail the gate, warnings never do.
export type ContractRuleMessages = {
  readonly violations: readonly string[]
  readonly warnings: readonly string[]
}

export type ContractRule = {
  readonly key: string
  readonly group: ContractRuleGroup
  readonly check: (input: ContractRuleInput) => ContractRuleMessages
}

// The table, one entry per rule, in report-group order.
export const contractRules: readonly ContractRule[] = [
  ...modelRules,
  ...geometryRules,
  ...materialRules,
  ...finishRules,
  ...cameraRules,
  ...explodeRules,
]

// Every group's messages, by group, each message prefixed with its rule's
// key.
export function runContractRules(
  input: ContractRuleInput,
): ReadonlyMap<ContractRuleGroup, ContractRuleMessages> {
  const byGroup = new Map<ContractRuleGroup, ContractRuleMessages>()
  for (const rule of contractRules) {
    const messages = rule.check(input)
    const held = byGroup.get(rule.group) ?? { violations: [], warnings: [] }
    byGroup.set(rule.group, {
      violations: [
        ...held.violations,
        ...messages.violations.map((message) => `${rule.key}: ${message}`),
      ],
      warnings: [
        ...held.warnings,
        ...messages.warnings.map((message) => `${rule.key}: ${message}`),
      ],
    })
  }
  return byGroup
}

// One report group with its rule messages folded in: the group's own check
// result keeps its detail, the rule messages append after its violations
// and warnings, and the status follows the merged violations.
export function withRuleMessages(
  check: CheckResult,
  findings: ReadonlyMap<ContractRuleGroup, ContractRuleMessages>,
  group: ContractRuleGroup,
): CheckResult {
  const messages = findings.get(group)
  if (messages === undefined) {
    return check
  }
  return checkResult(
    check.name,
    check.detail,
    [...check.violations, ...messages.violations],
    [...check.warnings, ...messages.warnings],
  )
}
