// The rule table itself: one entry per contract rule the shipped bytes
// prove, each key a kebab-case slug naming what the rule checks, folded
// into the report group the validate step prints, with every message
// prefixed by its rule's key; the key-shape guard that keeps external
// shorthand ids out of the committed table; and the merge that appends a
// group's rule messages to its report group.
import { describe, expect, it } from 'vitest'
import { contractRules, runContractRules, withRuleMessages } from './contractRules.ts'
import { addRootNode, buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'
import { checkResult } from './validateChecks.ts'

// The table's keys in report-group order, the one listing a new rule
// joins when it lands.
const TABLE_KEYS = [
  'nodes-carry-contract-names',
  'one-node-per-contract-name',
  'one-shadow-mesh',
  'no-extras',
  'no-lights',
  'shadow-root-one-material',
  'shadow-material-unlit-blend',
  'storage-matches-pipeline',
  'shadow-alpha-clear-at-border',
  'shadow-footprint-fits-plane',
  'parts-root-location-only',
  'no-duplicate-triangles',
  'tangents-with-normal-maps',
  'only-allowed-extensions',
  'single-sided-materials',
  'lit-materials-opaque',
  'lit-materials-occluded',
  'one-occlusion-image',
  'occlusion-texcoord-second-set',
  'variant-map-well-formed',
  'mappings-cover-every-variant',
  'default-is-first-finish',
  'camera-static-roll-free',
  'authored-minimum-needed',
  'home-holds-both-poses',
  'clip-channels-on-parts',
  'clip-first-key-at-rest',
  'clip-no-dead-head-or-tail',
]

describe('the contract rule table', () => {
  it('uses self-describing slugs for every rule key', () => {
    for (const { key } of contractRules) {
      expect(key).not.toMatch(/^[A-Z][0-9]+$/)
      expect(key).toMatch(/^[a-z]+(?:-[a-z]+)+$/)
    }
  })

  it('holds one entry per rule, keyed and grouped', () => {
    expect(contractRules.map((rule) => rule.key)).toEqual(TABLE_KEYS)
    const groups = new Map(contractRules.map((rule) => [rule.key, rule.group]))
    expect(Object.fromEntries(groups)).toEqual({
      'nodes-carry-contract-names': 'model',
      'one-node-per-contract-name': 'model',
      'one-shadow-mesh': 'model',
      'no-extras': 'model',
      'no-lights': 'model',
      'shadow-root-one-material': 'model',
      'shadow-material-unlit-blend': 'model',
      'storage-matches-pipeline': 'model',
      'shadow-alpha-clear-at-border': 'model',
      'shadow-footprint-fits-plane': 'model',
      'parts-root-location-only': 'geometry',
      'no-duplicate-triangles': 'geometry',
      'tangents-with-normal-maps': 'geometry',
      'only-allowed-extensions': 'materials',
      'single-sided-materials': 'materials',
      'lit-materials-opaque': 'materials',
      'lit-materials-occluded': 'materials',
      'one-occlusion-image': 'materials',
      'occlusion-texcoord-second-set': 'materials',
      'variant-map-well-formed': 'finishes',
      'mappings-cover-every-variant': 'finishes',
      'default-is-first-finish': 'finishes',
      'camera-static-roll-free': 'cameras',
      'authored-minimum-needed': 'cameras',
      'home-holds-both-poses': 'cameras',
      'clip-channels-on-parts': 'explode',
      'clip-first-key-at-rest': 'explode',
      'clip-no-dead-head-or-tail': 'explode',
    })
  })

  it('runs every rule clean over the valid document', async () => {
    const input = contractRuleInputOf(buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }))
    for (const messages of runContractRules(input).values()) {
      expect(messages).toEqual({ violations: [], warnings: [] })
    }
  })

  it('prefixes each message with its rule key and files it under its group', async () => {
    const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
    addRootNode(doc, 'PREVIEW_front')
    nodeNamed(doc, 'PART_knob').setRotation([0, 0, Math.SQRT1_2, Math.SQRT1_2])
    const findings = runContractRules(contractRuleInputOf(doc))
    expect(findings.get('model')?.violations).toEqual([
      "nodes-carry-contract-names: node 'PREVIEW_front' is outside the contract names PART_, HS_, CAM_ and SHADOW",
    ])
    expect(findings.get('geometry')?.violations).toEqual([
      'parts-root-location-only: the part PART_knob carries a rotation, parts carry location only',
    ])
  })

  it('merges a group messages into its report group, status following the violations', () => {
    const findings = new Map([
      [
        'geometry',
        {
          violations: ['parts-root-location-only: the part PART_knob carries a rotation'],
          warnings: [],
        },
      ],
    ] as const)
    const merged = withRuleMessages(
      checkResult('geometry', '2 primitives', []),
      findings,
      'geometry',
    )
    expect(merged).toEqual({
      name: 'geometry',
      status: 'fail',
      detail: '2 primitives',
      violations: ['parts-root-location-only: the part PART_knob carries a rotation'],
      warnings: [],
    })
    expect(
      withRuleMessages(
        checkResult(
          'cameras',
          'found CAM_home',
          [],
          ["camera CAM_side has no manifest hotspot 'side'"],
        ),
        findings,
        'cameras',
      ).warnings,
    ).toEqual(["camera CAM_side has no manifest hotspot 'side'"])
  })
})
