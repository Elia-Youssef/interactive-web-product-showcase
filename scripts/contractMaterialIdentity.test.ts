import type { Document } from '@gltf-transform/core'
import { KHRMaterialsUnlit, KHRMaterialsVariants } from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'
import { contractRuleInputOf } from './contractRuleFixtures.ts'
import { finishRules } from './contractRuleFinishes.ts'
import { geometryRules } from './contractRuleGeometry.ts'
import { materialRules } from './contractRuleMaterials.ts'
import { modelRules } from './contractRuleModel.ts'
import { buildDocument, nodeNamed, vec3Accessor } from './validateFixtures.ts'

function violations(doc: Document, key: string): readonly string[] {
  const rule = [...modelRules, ...finishRules, ...geometryRules, ...materialRules].find(
    (entry) => entry.key === key,
  )
  if (rule === undefined) throw new Error(`missing rule ${key}`)
  return rule.check(contractRuleInputOf(doc)).violations
}

describe('the contract material identity', () => {
  it.each(['shared', ''])('checks the second shadow material labelled %j', (name) => {
    const doc = buildDocument()
    const unlit = doc.createExtension(KHRMaterialsUnlit)
    doc
      .createMaterial(name)
      .setAlphaMode('BLEND')
      .setExtension('KHR_materials_unlit', unlit.createUnlit())
    const second = doc.createMaterial(name)
    const primitive = nodeNamed(doc, 'SHADOW').getMesh()?.listPrimitives()[0]
    if (primitive === undefined) throw new Error('missing shadow primitive')
    primitive.setMaterial(second)
    expect(violations(doc, 'shadow-material-unlit-blend')).toEqual([
      `the shadow material '${name}' is not unlit`,
      `the shadow material '${name}' is alphaMode OPAQUE, expected BLEND`,
    ])
    second.setAlphaMode('BLEND').setExtension('KHR_materials_unlit', unlit.createUnlit())
    expect(violations(doc, 'shadow-material-unlit-blend')).toEqual([])
  })

  it.each(['shared', ''])('distinguishes default and mapped materials labelled %j', (name) => {
    const doc = buildDocument()
    const primitive = nodeNamed(doc, 'PART_body').getMesh()?.listPrimitives()[0]
    const list = primitive?.getExtension('KHR_materials_variants')
    if (primitive === undefined || list === null) throw new Error('missing mapped primitive')
    const variants = doc.createExtension(KHRMaterialsVariants)
    const first = doc.createMaterial(name)
    const second = doc.createMaterial(name)
    primitive
      .setMaterial(second)
      .setExtension(
        'KHR_materials_variants',
        variants
          .createMappingList()
          .addMapping(
            variants.createMapping().setMaterial(first).addVariant(variants.createVariant('sage')),
          ),
      )
    expect(violations(doc, 'default-is-first-finish')).toEqual([
      `the primitive of PART_body defaults to '${name}', the first finish 'sage' maps '${name}'`,
    ])
    primitive.setMaterial(first)
    expect(violations(doc, 'default-is-first-finish')).toEqual([])
    expect(violations(doc, 'variant-map-well-formed')).toEqual([])
  })

  it.each(['shared', ''])('does not borrow a namesake normal map labelled %j', (name) => {
    const doc = buildDocument()
    doc.createMaterial(name).setNormalTexture(doc.createTexture())
    const second = doc.createMaterial(name)
    const primitive = nodeNamed(doc, 'PART_knob').getMesh()?.listPrimitives()[0]
    if (primitive === undefined) throw new Error('missing part primitive')
    primitive.setMaterial(second)
    expect(violations(doc, 'tangents-with-normal-maps')).toEqual([])
    second.setNormalTexture(doc.createTexture())
    expect(violations(doc, 'tangents-with-normal-maps')).toEqual([
      'the primitive of PART_knob wears a normal map without a TANGENT attribute',
    ])
  })

  it.each(['shared', ''])('checks only the bound sidedness material labelled %j', (name) => {
    const doc = buildDocument()
    doc.createMaterial(name).setDoubleSided(true)
    const second = doc.createMaterial(name)
    const primitive = nodeNamed(doc, 'PART_knob').getMesh()?.listPrimitives()[0]
    if (primitive === undefined) throw new Error('missing part primitive')
    primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]))
    primitive.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint16Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3])),
    )
    primitive.setMaterial(second)
    expect(violations(doc, 'single-sided-materials')).toEqual([])
    second.setDoubleSided(true)
    expect(violations(doc, 'single-sided-materials')).toEqual([
      `the material '${name}' is double-sided on the closed mesh of PART_knob, single-sided unless a mesh has open edges`,
    ])
  })
})
