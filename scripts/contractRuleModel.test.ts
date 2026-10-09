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
async function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): Promise<readonly string[]> {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the model rules hold no ${key}`)
  }
  return rule.check(await contractRuleInputOf(doc)).violations
}

describe('the model-group contract rules', () => {
  it('passes every rule on the valid document', async () => {
    const input = await contractRuleInputOf(
      buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
    )
    for (const rule of modelRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the storage rule reports a position stored another way than the pipeline stores it', async () => {
    const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
    const input = await contractRuleInputOf(doc)
    const rule = byKey.get('storage-matches-pipeline')
    if (rule === undefined) {
      throw new Error('the model rules hold no storage-matches-pipeline')
    }
    expect(
      rule.check({
        ...input,
        storage: {
          ...input.storage,
          positions: [
            { meshName: 'PART_base', componentType: 5126, normalized: false, offGridValues: 0 },
          ],
        },
      }).violations,
    ).toEqual([
      "the POSITION of the mesh 'PART_base' is stored as component type 5126, not normalized, the pipeline's 14-bit quantize stores normalized Int16",
    ])
  })

  it('the storage rule reports a translation output stored without the key filter', async () => {
    const rule = byKey.get('storage-matches-pipeline')
    if (rule === undefined) {
      throw new Error('the model rules hold no storage-matches-pipeline')
    }
    const input = await contractRuleInputOf(
      buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
    )
    expect(
      rule.check({
        ...input,
        storage: {
          ...input.storage,
          translationOutputs: [
            {
              animationName: 'Explode',
              targetName: 'PART_base',
              storage: { kind: 'otherFilter', filter: null },
            },
          ],
        },
      }).violations,
    ).toEqual([
      "the translation output of 'PART_base' in the animation 'Explode' is stored with filter none, the pipeline's key filter is EXPONENTIAL at 12 bits",
    ])
  })

  it('the storage rule reports stored positions off the grid and keys wider than the key bits', async () => {
    const rule = byKey.get('storage-matches-pipeline')
    if (rule === undefined) {
      throw new Error('the model rules hold no storage-matches-pipeline')
    }
    const input = await contractRuleInputOf(
      buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
    )
    expect(
      rule.check({
        ...input,
        storage: {
          positions: [
            { meshName: 'PART_base', componentType: 5122, normalized: true, offGridValues: 3 },
          ],
          translationOutputs: [
            {
              animationName: 'Explode',
              targetName: 'PART_base',
              storage: { kind: 'exponential', keyBits: 16 },
            },
          ],
        },
      }).violations,
    ).toEqual([
      "the POSITION of the mesh 'PART_base' holds 3 stored values off the grid of the pipeline's 14-bit quantize",
      "the translation output of 'PART_base' in the animation 'Explode' stores mantissas of 16 bits, the pipeline's key filter stores 12",
    ])
  })

  it('the contract-names rule reports a node outside the contract names', async () => {
    expect(
      await violationsOf('nodes-carry-contract-names', (doc) => addRootNode(doc, 'PREVIEW_front')),
    ).toEqual(["node 'PREVIEW_front' is outside the contract names PART_, HS_, CAM_ and SHADOW"])
  })

  it('the one-node rule reports a repeated contract name', async () => {
    expect(
      await violationsOf('one-node-per-contract-name', (doc) => addRootNode(doc, 'PART_base')),
    ).toEqual(["node name 'PART_base' appears 2 times, the contract needs one node per name"])
  })

  it('the one-shadow rule reports a missing shadow and a second one', async () => {
    expect(
      await violationsOf('one-shadow-mesh', (doc) => nodeNamed(doc, 'SHADOW').dispose()),
    ).toEqual(['expected exactly one SHADOW mesh, found 0'])
    expect(await violationsOf('one-shadow-mesh', (doc) => addRootNode(doc, 'SHADOW'))).toEqual([
      'expected exactly one SHADOW mesh, found 2',
    ])
  })

  it('the no-extras rule reports extras wherever they sit', async () => {
    expect(
      await violationsOf('no-extras', (doc) =>
        nodeNamed(doc, 'PART_base').setExtras({ note: 'x' }),
      ),
    ).toEqual(['node PART_base carries extras, no custom property may reach the file'])
  })

  it('the no-lights rule reports a light', async () => {
    expect(
      await violationsOf('no-lights', (doc) => {
        const lights = doc.createExtension(KHRLightsPunctual)
        nodeNamed(doc, 'PART_base').setExtension('KHR_lights_punctual', lights.createLight())
      }),
    ).toEqual(['the model carries lights, the site lights the product with its environment only'])
  })

  it('the shadow root rule reports a shadow parented to a part', async () => {
    expect(
      await violationsOf('shadow-root-one-material', (doc) => {
        nodeNamed(doc, 'PART_base').addChild(nodeNamed(doc, 'SHADOW'))
      }),
    ).toEqual(['the SHADOW node is not a root object, it must not be parented to a part'])
  })

  it('the shadow material rule reports one that is not unlit blend', async () => {
    expect(
      await violationsOf('shadow-material-unlit-blend', (doc) => {
        const material = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'MAT_shadow')
        material?.setAlphaMode('OPAQUE')
      }),
    ).toEqual(["the shadow material 'MAT_shadow' is alphaMode OPAQUE, expected BLEND"])
  })
})
