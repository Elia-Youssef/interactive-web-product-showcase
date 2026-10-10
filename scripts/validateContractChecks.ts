import { runContractRules, withRuleMessages } from './contractRules.ts'
import type { AvailableContractRuleInput } from './contractRules.ts'
import { checkCameras } from './validateCameras.ts'
import {
  checkExplode,
  checkFinishes,
  checkGeometry,
  checkHotspots,
  checkMaterials,
  skippedCheck,
  type CheckResult,
} from './validateChecks.ts'

export function validateContractChecks(
  input: AvailableContractRuleInput,
  modelCheck: CheckResult,
): CheckResult[] {
  const findings = runContractRules(input)
  return baseChecks(input, modelCheck).map((check) => {
    switch (check.name) {
      case 'model':
      case 'cameras':
      case 'geometry':
      case 'finishes':
      case 'materials':
      case 'explode':
        return withRuleMessages(check, findings, check.name)
      default:
        return check
    }
  })
}

// Base checks have their own input needs. A report group may contain a
// skipped manifest check and completed model rules, with both stated.
function baseChecks(
  { manifest, structure, contract }: AvailableContractRuleInput,
  modelCheck: CheckResult,
): CheckResult[] {
  const reason = manifest === null ? 'the manifest did not load' : 'the model did not read'
  const paired =
    manifest !== null && structure !== null
      ? [
          checkHotspots(manifest, structure),
          checkFinishes(manifest, structure),
          checkExplode(manifest, structure),
        ]
      : ['hotspots', 'finishes', 'explode'].map((name) => skippedCheck(name, reason))
  const [hotspots, finishes, explode] = paired
  if (hotspots === undefined || finishes === undefined || explode === undefined) {
    throw new Error('the paired check groups must each have a result')
  }
  const cameras =
    manifest !== null && structure !== null && contract !== null
      ? checkCameras(manifest, structure, contract)
      : skippedCheck('cameras', contract === null ? 'the camera contract did not load' : reason)
  return [
    modelCheck,
    hotspots,
    cameras,
    structure === null
      ? skippedCheck('geometry', 'the model did not read')
      : checkGeometry(structure),
    finishes,
    structure === null
      ? skippedCheck('materials', 'the model did not read')
      : checkMaterials(structure),
    explode,
  ]
}
