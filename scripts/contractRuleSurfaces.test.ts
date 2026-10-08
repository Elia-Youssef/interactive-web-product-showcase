// The material- and finishes-group rules over the fixture document: each
// rule passes on the valid document and fails once on the one defect that
// breaks it, by the exact message the rule reports.
import { describe, expect, it } from 'vitest'
import {
  KHRMaterialsEmissiveStrength,
  KHRMaterialsVariants,
  type MappingList,
} from '@gltf-transform/extensions'
import { materialRules } from './contractRuleMaterials.ts'
import { finishRules } from './contractRuleFinishes.ts'
import { buildDocument, nodeNamed, vec3Accessor } from './validateFixtures.ts'
import { contractRuleInputOf } from './contractRuleFixtures.ts'

const surfaceRules = [...materialRules, ...finishRules]
const byKey = new Map(surfaceRules.map((rule) => [rule.key, rule]))

async function violationsOf(
  key: string,
  plant: (doc: ReturnType<typeof buildDocument>) => void,
): Promise<readonly string[]> {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  plant(doc)
  const rule = byKey.get(key)
  if (rule === undefined) {
    throw new Error(`the surface rules hold no ${key}`)
  }
  return rule.check(await contractRuleInputOf(doc)).violations
}

// A closed cube mesh grafted on a part: twelve triangles, every edge
// shared by two of them.
function addClosedCube(doc: ReturnType<typeof buildDocument>, materialName: string): void {
  const material = doc.createMaterial(materialName)
  const mesh = doc.createMesh('cube')
  const primitive = doc.createPrimitive()
  primitive.setAttribute(
    'POSITION',
    vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  )
  primitive.setIndices(
    doc
      .createAccessor()
      .setType('SCALAR')
      .setArray(
        new Uint16Array([
          0, 3, 2, 0, 2, 1, 4, 6, 7, 4, 5, 6, 0, 4, 5, 0, 5, 1, 2, 6, 5, 2, 5, 1, 0, 7, 4, 0, 3, 7,
          2, 3, 6, 3, 7, 6,
        ]),
      )
      .setBuffer(doc.getRoot().listBuffers()[0] ?? doc.createBuffer()),
  )
  primitive.setMaterial(material)
  mesh.addPrimitive(primitive)
  nodeNamed(doc, 'PART_knob').addChild(doc.createNode('').setMesh(mesh))
}

// The fixture body primitive's variant list, to bend a mapping.
function bodyVariantList(doc: ReturnType<typeof buildDocument>): MappingList {
  const primitive = nodeNamed(doc, 'PART_body').getMesh()?.listPrimitives()[0]
  const list = primitive?.getExtension<MappingList>('KHR_materials_variants')
  if (list === null || list === undefined) {
    throw new Error('the fixture body primitive carries variants')
  }
  return list
}

describe('the surface contract rules', () => {
  it('passes every rule on the valid document', async () => {
    const input = await contractRuleInputOf(
      buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
    )
    for (const rule of surfaceRules) {
      expect(rule.check(input), rule.key).toEqual({ violations: [], warnings: [] })
    }
  })

  it('the extensions rule reports one outside the allowed set', async () => {
    expect(
      await violationsOf('only-allowed-extensions', (doc) => {
        const strength = doc.createExtension(KHRMaterialsEmissiveStrength)
        doc
          .createMaterial('MAT_glow')
          .setExtension('KHR_materials_emissive_strength', strength.createEmissiveStrength())
      }),
    ).toEqual([
      "the file uses extension 'KHR_materials_emissive_strength', outside the allowed set",
    ])
  })

  it('the single-sided rule reports a double-sided material on a closed mesh, and passes one on open edges', async () => {
    expect(
      await violationsOf('single-sided-materials', (doc) => {
        addClosedCube(doc, 'MAT_shell')
        const shell = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'MAT_shell')
        shell?.setDoubleSided(true)
      }),
    ).toEqual([
      "the material 'MAT_shell' is double-sided on the closed mesh of PART_knob, single-sided unless a mesh has open edges",
    ])
    expect(
      await violationsOf('single-sided-materials', (doc) => {
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.setDoubleSided(true)
      }),
    ).toEqual([])
  })

  it('the opaque rule reports a lit material that is not opaque, and passes the unlit shadow', async () => {
    expect(
      await violationsOf('lit-materials-opaque', (doc) => {
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.setAlphaMode('MASK')
      }),
    ).toEqual(["the lit material 'body-graphite' is alphaMode MASK, lit materials are opaque"])
    expect(
      await violationsOf('lit-materials-opaque', (doc) => {
        const shadow = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'MAT_shadow')
        shadow?.setAlphaMode('BLEND')
      }),
    ).toEqual([])
  })

  it('the occlusion coverage rule reports a lit material without an occlusion texture, and passes the unlit shadow', async () => {
    expect(
      await violationsOf('lit-materials-occluded', (doc) => {
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.setOcclusionTexture(null)
      }),
    ).toEqual([
      "the lit material 'body-graphite' carries no occlusion texture, " +
        'every lit material samples the shared occlusion image',
    ])
    expect(
      await violationsOf('lit-materials-occluded', (doc) => {
        const shadow = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'MAT_shadow')
        shadow?.setOcclusionTexture(null)
      }),
    ).toEqual([])
  })

  it('the occlusion identity rule reports occlusion slots on two images', async () => {
    expect(
      await violationsOf('one-occlusion-image', (doc) => {
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.setOcclusionTexture(doc.createTexture('T_ao_second').setMimeType('image/png'))
      }),
    ).toEqual(['the occlusion slots sample 2 images (0, 1), one occlusion image across the file'])
  })

  it('the occlusion texCoord rule reports a slot off the second UV set', async () => {
    expect(
      await violationsOf('occlusion-texcoord-second-set', (doc) => {
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        graphite?.getOcclusionTextureInfo()?.setTexCoord(0)
      }),
    ).toEqual([
      "the occlusion slot of 'body-graphite' samples texCoord 0, the occlusion UV map is TEXCOORD_1",
    ])
  })

  it('the variant-map rule reports a mapping without variants or a material', async () => {
    expect(
      await violationsOf('variant-map-well-formed', (doc) => {
        const list = bodyVariantList(doc)
        list.addMapping(doc.createExtension(KHRMaterialsVariants).createMapping())
      }),
    ).toEqual([
      "the variant mapping of PART_body names no material of the file: 'none'",
      'the variant mapping of PART_body names no variant',
    ])
  })

  it('the coverage rule reports a finish no mapping of the primitive covers', async () => {
    expect(
      await violationsOf('mappings-cover-every-variant', (doc) => {
        const list = bodyVariantList(doc)
        const mapping = list.listMappings()[1]
        const variant = mapping?.listVariants()[0]
        if (mapping !== undefined && variant !== undefined) {
          mapping.removeVariant(variant)
        }
      }),
    ).toEqual([
      "the primitive of PART_body maps some finishes but not 'graphite', a finish-dependent slot maps every variant",
    ])
  })

  it('the default-finish rule reports a default that is not the first finish', async () => {
    expect(
      await violationsOf('default-is-first-finish', (doc) => {
        const primitive = nodeNamed(doc, 'PART_body').getMesh()?.listPrimitives()[0]
        const graphite = doc
          .getRoot()
          .listMaterials()
          .find((m) => m.getName() === 'body-graphite')
        primitive?.setMaterial(graphite ?? null)
      }),
    ).toEqual([
      "the primitive of PART_body defaults to 'body-graphite', the first finish 'sage' maps 'body-sage'",
    ])
  })
})
