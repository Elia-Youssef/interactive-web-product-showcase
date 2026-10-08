// The model-group rules over the fixture document: each rule passes on the
// valid document and fails once on the one defect that breaks it, by the
// exact prefixed message the report prints.
import { describe, expect, it } from 'vitest'
import { KHRLightsPunctual } from '@gltf-transform/extensions'
import { modelRules } from './contractRuleModel.ts'
import { addRootNode, buildDocument, nodeNamed } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'

const byKey = new Map(modelRules.map((rule) => [rule.key, rule]))

// The violations of one rule over a planted document.
function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): readonly string[] {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the model rules hold no ${key}`)
  }
  return rule.check(contractRuleInputOf(doc)).violations
}

describe('the model-group contract rules', () => {
  it('passes every rule on the valid document', () => {
    const input = contractRuleInputOf(buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }))
    for (const rule of modelRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the contract-names rule reports a node outside the contract names', () => {
    expect(
      violationsOf('nodes-carry-contract-names', (doc) => addRootNode(doc, 'PREVIEW_front')),
    ).toEqual(["node 'PREVIEW_front' is outside the contract names PART_, HS_, CAM_ and SHADOW"])
  })

  it('the one-node rule reports a repeated contract name', () => {
    expect(
      violationsOf('one-node-per-contract-name', (doc) => addRootNode(doc, 'PART_base')),
    ).toEqual(["node name 'PART_base' appears 2 times, the contract needs one node per name"])
  })

  it('the one-shadow rule reports a missing shadow and a second one', () => {
    expect(violationsOf('one-shadow-mesh', (doc) => nodeNamed(doc, 'SHADOW').dispose())).toEqual([
      'expected exactly one SHADOW mesh, found 0',
    ])
    expect(violationsOf('one-shadow-mesh', (doc) => addRootNode(doc, 'SHADOW'))).toEqual([
      'expected exactly one SHADOW mesh, found 2',
    ])
  })

  it('the no-extras rule reports extras wherever they sit', () => {
    expect(
      violationsOf('no-extras', (doc) => nodeNamed(doc, 'PART_base').setExtras({ note: 'x' })),
    ).toEqual(['node PART_base carries extras, no custom property may reach the file'])
  })

  it('the no-lights rule reports a light', () => {
    expect(
      violationsOf('no-lights', (doc) => {
        const lights = doc.createExtension(KHRLightsPunctual)
        nodeNamed(doc, 'PART_base').setExtension('KHR_lights_punctual', lights.createLight())
      }),
    ).toEqual(['the model carries lights, the site lights the product with its environment only'])
  })

  it('the shadow root rule reports a shadow parented to a part', () => {
    expect(
      violationsOf('shadow-root-one-material', (doc) => {
        nodeNamed(doc, 'PART_base').addChild(nodeNamed(doc, 'SHADOW'))
      }),
    ).toEqual(['the SHADOW node is not a root object, it must not be parented to a part'])
  })

  it('the shadow material rule reports one that is not unlit blend', () => {
    expect(
      violationsOf('shadow-material-unlit-blend', (doc) => {
        const material = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'MAT_shadow')
        material?.setAlphaMode('OPAQUE')
      }),
    ).toEqual(["the shadow material 'MAT_shadow' is alphaMode OPAQUE, expected BLEND"])
  })
})
