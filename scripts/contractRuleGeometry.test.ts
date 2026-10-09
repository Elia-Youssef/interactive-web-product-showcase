// The geometry-group rules over the fixture document: each rule passes on
// the valid document and fails once on the one defect that breaks it, by
// the exact message the rule reports.
import { describe, expect, it } from 'vitest'
import { geometryRules } from './contractRuleGeometry.ts'
import { buildDocument, nodeNamed, vec3Accessor } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'

const byKey = new Map(geometryRules.map((rule) => [rule.key, rule]))

async function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): Promise<readonly string[]> {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the geometry rules hold no ${key}`)
  }
  return rule.check(contractRuleInputOf(doc)).violations
}

describe('the geometry-group contract rules', () => {
  it('passes every rule on the valid document', async () => {
    const input = contractRuleInputOf(buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }))
    for (const rule of geometryRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the parts rule reports a part that carries a rotation', async () => {
    expect(
      await violationsOf('parts-root-location-only', (doc) => {
        nodeNamed(doc, 'PART_knob').setRotation([0, 0, Math.SQRT1_2, Math.SQRT1_2])
      }),
    ).toEqual(['the part PART_knob carries a rotation, parts carry location only'])
  })

  it('the parts rule reports a part that is parented', async () => {
    expect(
      await violationsOf('parts-root-location-only', (doc) => {
        nodeNamed(doc, 'PART_base').addChild(nodeNamed(doc, 'PART_knob'))
      }),
    ).toEqual(['the part PART_knob is not a root object, parts parent nowhere'])
  })

  it('the duplicate-sheet rule reports a coincident duplicate triangle', async () => {
    expect(
      await violationsOf('no-duplicate-triangles', (doc) => {
        const primitive = nodeNamed(doc, 'PART_knob').getMesh()?.listPrimitives()[0]
        const indices = primitive?.getIndices() ?? null
        if (indices === null) {
          throw new Error('the fixture primitive carries indices')
        }
        indices.setArray(new Uint16Array([0, 1, 2, 0, 2, 3, 0, 2, 3]))
      }),
    ).toEqual(['the mesh of PART_knob holds 1 coincident duplicate triangles, no duplicate sheets'])
  })

  it('the tangent rule reports a normal map without tangents, and passes them present', async () => {
    const normalMap = (doc: ReturnType<typeof buildDocument>) => {
      const texture = doc
        .createTexture('T_normal')
        .setImage(new Uint8Array(8))
        .setMimeType('image/png')
      const material = doc.createMaterial('MAT_bumped')
      material.setNormalTexture(texture)
      const primitive = nodeNamed(doc, 'PART_knob').getMesh()?.listPrimitives()[0]
      primitive?.setMaterial(material)
      return primitive
    }
    expect(await violationsOf('tangents-with-normal-maps', (doc) => void normalMap(doc))).toEqual([
      'the primitive of PART_knob wears a normal map without a TANGENT attribute',
    ])
    expect(
      await violationsOf('tangents-with-normal-maps', (doc) => {
        const primitive = normalMap(doc)
        primitive?.setAttribute('TANGENT', vec3Accessor(doc, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
      }),
    ).toEqual([])
  })

  it('the tangent rule counts a normal map that only a variant mapping wears', async () => {
    // The graphite finish's mapped material alone carries the normal map,
    // while the primitive's default stays plain: the mapping counts.
    expect(
      await violationsOf('tangents-with-normal-maps', (doc) => {
        const texture = doc
          .createTexture('T_normal')
          .setImage(new Uint8Array(8))
          .setMimeType('image/png')
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.setNormalTexture(texture)
      }),
    ).toEqual(['the primitive of PART_body wears a normal map without a TANGENT attribute'])
  })
})
