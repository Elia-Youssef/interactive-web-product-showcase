import type { Document } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'
import { dedup } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { findPreservationLosses, readProductPreservation } from './preservationCompare.ts'

function mappingsOf(doc: Document): MappingList {
  const list = doc
    .getRoot()
    .listMeshes()[0]
    ?.listPrimitives()[0]
    ?.getExtension<MappingList>('KHR_materials_variants')
  if (list === undefined || list === null) throw new Error('missing fixture mappings')
  return list
}

describe('semantic identities across representations', () => {
  it('rejects changed primitive rest geometry with every node rest unchanged', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    for (const primitive of doc.getRoot().listMeshes()[0]?.listPrimitives() ?? []) {
      const position = primitive.getAttribute('POSITION')
      position?.setArray(
        new Float32Array(Array.from(position.getArray() ?? [], (value) => value + 10)),
      )
    }
    const after = readProductPreservation(doc)
    expect(after.semantics.rests.map((rest) => rest.matrix)).toEqual(
      before.semantics.rests.map((rest) => rest.matrix),
    )
    expect(findPreservationLosses(before, after)).toContain(
      'primitive rest or assignment changed: PART_body:0',
    )
  })

  it('rejects reassignment between distinct materials sharing the same name', () => {
    const doc = preservationFixture()
    for (const material of doc.getRoot().listMaterials()) material.setName('MAT_shared')
    const before = readProductPreservation(doc)
    mappingsOf(doc)
      .listMappings()[0]
      ?.setMaterial(doc.getRoot().listMaterials()[1] ?? null)
    expect(findPreservationLosses(before, readProductPreservation(doc))).toContain(
      'primitive rest or assignment changed: PART_body:0',
    )
  })

  it('rejects changed assigned material values while retaining every identity', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    doc.getRoot().listMaterials()[0]?.setBaseColorFactor([1, 0, 0, 1])
    expect(findPreservationLosses(before, readProductPreservation(doc))).toContain(
      'primitive rest or assignment changed: PART_body:0',
    )
  })

  it('accepts byte-identical material deduplication', async () => {
    const doc = preservationFixture()
    const original = doc.getRoot().listMaterials()[0]
    if (original === undefined) throw new Error('missing fixture material')
    const duplicate = doc
      .createMaterial('MAT_duplicate')
      .setBaseColorFactor(original.getBaseColorFactor())
    mappingsOf(doc).listMappings()[0]?.setMaterial(duplicate)
    const before = readProductPreservation(doc)
    await doc.transform(dedup())
    expect(doc.getRoot().listMaterials()).not.toContain(duplicate)
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual([])
  })

  it('accepts mapping groups with identical per-variant assignments', () => {
    const doc = preservationFixture()
    const list = mappingsOf(doc)
    const [first, second] = list.listMappings()
    if (first === undefined || second === undefined) throw new Error('missing fixture mapping')
    second.setMaterial(first.getMaterial())
    const before = readProductPreservation(doc)
    for (const variant of second.listVariants()) first.addVariant(variant)
    list.removeMapping(second)
    const after = readProductPreservation(doc)
    expect(after.structure.mappingCount).toBe(before.structure.mappingCount - 1)
    expect(findPreservationLosses(before, after)).toEqual([])
  })

  it('rejects reassigned variants without changing materials or mapping counts', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    const [first, second] = mappingsOf(doc).listMappings()
    if (first === undefined || second === undefined) throw new Error('missing fixture mapping')
    const [light] = first.listVariants()
    const [dark] = second.listVariants()
    if (light === undefined || dark === undefined) throw new Error('missing fixture variant')
    first.removeVariant(light).addVariant(dark)
    second.removeVariant(dark).addVariant(light)
    const after = readProductPreservation(doc)
    expect(after.structure.mappingCount).toBe(before.structure.mappingCount)
    expect(findPreservationLosses(before, after)).toContain(
      'primitive rest or assignment changed: PART_body:0',
    )
  })

  it('preserves anchor world rests across an unnamed wrapper', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    const part = namedNode(doc, 'PART_body')
    const anchor = namedNode(doc, 'HS_detail')
    part.removeChild(anchor).addChild(doc.createNode().addChild(anchor))
    expect(findPreservationLosses(before, readProductPreservation(doc))).toEqual([])
  })

  it('rejects a static rest rotation even when its world bounds are unchanged', () => {
    const doc = preservationFixture()
    for (const primitive of doc.getRoot().listMeshes()[0]?.listPrimitives() ?? []) {
      primitive
        .getAttribute('POSITION')
        ?.setArray(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]))
    }
    const before = readProductPreservation(doc)
    namedNode(doc, 'PART_other').setRotation([0, 0, 1, 0])
    const after = readProductPreservation(doc)
    expect(after.semantics.primitives.find((fact) => fact.key === 'PART_other:0')?.bounds).toEqual(
      before.semantics.primitives.find((fact) => fact.key === 'PART_other:0')?.bounds,
    )
    expect(findPreservationLosses(before, after)).toContain('world rest changed: PART_other')
  })

  it('rejects tiny authored rest shifts below the position quantization bound', () => {
    const doc = preservationFixture()
    const before = readProductPreservation(doc)
    namedNode(doc, 'PART_other').setTranslation([Number.EPSILON, 0, 0])
    expect(findPreservationLosses(before, readProductPreservation(doc))).toContain(
      'world rest changed: PART_other',
    )
  })

  it('rejects ambiguous named channel targets', () => {
    const doc = preservationFixture()
    const animation = doc.getRoot().listAnimations()[0]
    const channel = animation?.listChannels()[0]
    if (animation === undefined || channel === undefined) throw new Error('missing fixture channel')
    animation.addChannel(
      doc
        .createAnimationChannel()
        .setTargetNode(channel.getTargetNode())
        .setTargetPath('translation')
        .setSampler(channel.getSampler()),
    )
    const facts = readProductPreservation(doc)
    expect(() => findPreservationLosses(facts, facts)).toThrow('ambiguous preservation identity')
  })

  it('rejects duplicate variant assignments', () => {
    const doc = preservationFixture()
    const list = mappingsOf(doc)
    const mapping = list.listMappings()[0]
    const variant = mapping?.listVariants()[0]
    if (mapping === undefined || variant === undefined) throw new Error('missing fixture mapping')
    list.addMapping(
      doc
        .createExtension(KHRMaterialsVariants)
        .createMapping()
        .setMaterial(mapping.getMaterial())
        .addVariant(variant),
    )
    const facts = readProductPreservation(doc)
    expect(() => findPreservationLosses(facts, facts)).toThrow('ambiguous preservation identity')
  })
})
