import { describe, expect, it } from 'vitest'
import { contractRules, runContractRules, withRuleMessages } from './contractRules.ts'
import type { ContractFact } from './contractRules.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'
import { buildDocument } from './validateFixtures.ts'
import { skippedCheck } from './validateChecks.ts'

const NEEDS: Readonly<Record<string, readonly ContractFact[]>> = {
  'nodes-carry-contract-names': ['facts'],
  'one-node-per-contract-name': ['facts'],
  'one-shadow-mesh': ['facts'],
  'no-extras': ['facts'],
  'no-lights': ['facts'],
  'shadow-root-one-material': ['facts'],
  'shadow-material-unlit-blend': ['facts'],
  'storage-matches-pipeline': ['storage'],
  'shadow-alpha-clear-at-border': ['shadow'],
  'shadow-footprint-fits-plane': ['shadow'],
  'parts-root-location-only': ['facts'],
  'no-duplicate-triangles': ['facts'],
  'tangents-with-normal-maps': ['facts'],
  'only-allowed-extensions': ['facts'],
  'single-sided-materials': ['facts'],
  'lit-materials-opaque': ['facts'],
  'lit-materials-occluded': ['facts'],
  'one-occlusion-image': ['facts'],
  'occlusion-texcoord-second-set': ['facts'],
  'variant-map-well-formed': ['facts', 'structure'],
  'mappings-cover-every-variant': ['facts', 'structure'],
  'default-is-first-finish': ['manifest', 'facts'],
  'camera-static-roll-free': ['facts', 'structure'],
  'authored-minimum-needed': ['manifest', 'structure', 'contract'],
  'home-holds-both-poses': ['structure', 'homeFit'],
  'clip-channels-on-parts': ['structure'],
  'clip-first-key-at-rest': ['facts', 'structure'],
  'clip-no-dead-head-or-tail': ['structure'],
}
const FACTS: readonly ContractFact[] = [
  'manifest',
  'structure',
  'facts',
  'storage',
  'shadow',
  'homeFit',
  'contract',
]

describe('contract rule dependencies', () => {
  it('declares the actual input needs of every rule', () => {
    expect(Object.fromEntries(contractRules.map((rule) => [rule.key, rule.needs]))).toEqual(NEEDS)
  })

  it.each(FACTS)('runs every independent rule when %s is unavailable', (missing) => {
    const input = contractRuleInputOf(buildDocument())
    const findings = runContractRules({ ...input, [missing]: null })
    const checked = [...findings.values()].flatMap((group) => group.checkedRules ?? [])
    const skipped = [...findings.values()].flatMap((group) => group.skipped ?? [])
    expect(checked).toEqual(
      Object.entries(NEEDS)
        .filter(([, needs]) => !needs.includes(missing))
        .map(([key]) => key),
    )
    expect(skipped).toEqual(
      Object.entries(NEEDS)
        .filter(([, needs]) => needs.includes(missing))
        .map(([key]) => `${key}: skipped: missing ${missing}`),
    )
  })

  it('names all missing inputs without running a dependent rule', () => {
    const input = contractRuleInputOf(buildDocument())
    const findings = runContractRules({ ...input, manifest: null, facts: null, structure: null })
    expect(findings.get('finishes')?.skipped).toEqual([
      'variant-map-well-formed: skipped: missing facts, structure',
      'mappings-cover-every-variant: skipped: missing facts, structure',
      'default-is-first-finish: skipped: missing manifest, facts',
    ])
    const check = withRuleMessages(
      skippedCheck('finishes', 'the model did not read'),
      findings,
      'finishes',
    )
    expect(check.status).toBe('skipped')
    expect(check.detail).toContain('missing facts, structure')
  })
})
