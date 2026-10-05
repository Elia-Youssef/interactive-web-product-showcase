// The tangent stage tests: one test per class member of the primitives the
// stage decides on, over the in-memory fixture documents, plus the
// idempotence of the whole pass.
import { describe, expect, it } from 'vitest'
import { docWithPrimitives, primitiveAt, tangentOf } from './tangents.fixtures.ts'
import { dropUnusedTangents } from './tangents.ts'

describe('dropUnusedTangents', () => {
  it('strips TANGENT from a primitive whose material needs no tangent frame', () => {
    const doc = docWithPrimitives([{ material: {} }])
    const primitive = primitiveAt(doc, 0)
    const tangent = tangentOf(primitive)
    expect(tangent).not.toBeNull()
    const tangentBytes = tangent?.getByteLength() ?? 0
    const report = dropUnusedTangents(doc)
    expect(report).toEqual({
      primitivesStripped: 1,
      primitivesKept: 0,
      accessorBytesRemoved: tangentBytes,
    })
    expect(tangentOf(primitive)).toBeNull()
    expect(tangent?.isDisposed()).toBe(true)
    // The stage touches the TANGENT attribute only.
    expect(primitive.getAttribute('POSITION')).not.toBeNull()
    expect(primitive.getIndices()).not.toBeNull()
  })

  it('strips the morph target TANGENT with its base, and keeps it with a kept base', () => {
    const doc = docWithPrimitives([{ material: {} }, { material: { normalTexture: true } }])
    const targetTangents = [0, 1].map((index) => {
      const accessor = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]))
      const target = doc.createPrimitiveTarget().setAttribute('TANGENT', accessor)
      primitiveAt(doc, index).addTarget(target)
      return accessor
    })
    const strippedBytes =
      (tangentOf(primitiveAt(doc, 0))?.getByteLength() ?? 0) +
      (targetTangents[0]?.getByteLength() ?? 0)
    const report = dropUnusedTangents(doc)
    expect(report.accessorBytesRemoved).toBe(strippedBytes)
    expect(primitiveAt(doc, 0).listTargets()[0]?.getAttribute('TANGENT')).toBeNull()
    expect(targetTangents[0]?.isDisposed()).toBe(true)
    expect(primitiveAt(doc, 1).listTargets()[0]?.getAttribute('TANGENT')).toBe(targetTangents[1])
    expect(targetTangents[1]?.isDisposed()).toBe(false)
  })

  it('strips TANGENT from a primitive with no material', () => {
    const doc = docWithPrimitives([{ material: null }])
    const primitive = primitiveAt(doc, 0)
    const report = dropUnusedTangents(doc)
    expect(report.primitivesStripped).toBe(1)
    expect(report.primitivesKept).toBe(0)
    expect(tangentOf(primitive)).toBeNull()
  })

  it('keeps TANGENT when the default material has a normal texture', () => {
    const doc = docWithPrimitives([{ material: { normalTexture: true } }])
    const primitive = primitiveAt(doc, 0)
    const tangent = tangentOf(primitive)
    const report = dropUnusedTangents(doc)
    expect(report).toEqual({
      primitivesStripped: 0,
      primitivesKept: 1,
      accessorBytesRemoved: 0,
    })
    expect(tangentOf(primitive)).toBe(tangent)
    expect(tangent?.isDisposed()).toBe(false)
  })

  it('keeps TANGENT when only a variant material has a normal texture', () => {
    const doc = docWithPrimitives([{ material: {}, variantMaterials: [{ normalTexture: true }] }])
    const primitive = primitiveAt(doc, 0)
    const tangent = tangentOf(primitive)
    const report = dropUnusedTangents(doc)
    expect(report).toEqual({
      primitivesStripped: 0,
      primitivesKept: 1,
      accessorBytesRemoved: 0,
    })
    expect(tangentOf(primitive)).toBe(tangent)
    // The mappings that forced the keep are untouched.
    expect(primitive.getExtension('KHR_materials_variants')).not.toBeNull()
  })

  it('keeps TANGENT when one of several variant materials needs it', () => {
    const doc = docWithPrimitives([
      { material: {}, variantMaterials: [{}, { normalTexture: true }] },
    ])
    const primitive = primitiveAt(doc, 0)
    const report = dropUnusedTangents(doc)
    expect(report.primitivesStripped).toBe(0)
    expect(report.primitivesKept).toBe(1)
    expect(tangentOf(primitive)).not.toBeNull()
  })

  it('keeps TANGENT for the anisotropy extension alone', () => {
    const doc = docWithPrimitives([{ material: { anisotropy: true } }])
    const primitive = primitiveAt(doc, 0)
    const report = dropUnusedTangents(doc)
    expect(report.primitivesStripped).toBe(0)
    expect(report.primitivesKept).toBe(1)
    expect(tangentOf(primitive)).not.toBeNull()
  })

  it('keeps TANGENT for a clearcoat normal texture alone', () => {
    const doc = docWithPrimitives([{ material: { clearcoatNormalTexture: true } }])
    const primitive = primitiveAt(doc, 0)
    const report = dropUnusedTangents(doc)
    expect(report.primitivesStripped).toBe(0)
    expect(report.primitivesKept).toBe(1)
    expect(tangentOf(primitive)).not.toBeNull()
  })

  it('strips TANGENT when the only texture consumes no tangent frame', () => {
    const doc = docWithPrimitives([{ material: { baseColorTexture: true } }])
    const primitive = primitiveAt(doc, 0)
    const report = dropUnusedTangents(doc)
    expect(report.primitivesStripped).toBe(1)
    expect(tangentOf(primitive)).toBeNull()
  })

  it('keeps a shared TANGENT accessor for the one primitive that can use it', () => {
    const doc = docWithPrimitives([
      { material: { normalTexture: true }, sharedTangent: true },
      { material: {}, sharedTangent: true },
    ])
    const shared = tangentOf(primitiveAt(doc, 0))
    expect(tangentOf(primitiveAt(doc, 1))).toBe(shared)
    const report = dropUnusedTangents(doc)
    expect(report).toEqual({
      primitivesStripped: 1,
      primitivesKept: 1,
      accessorBytesRemoved: 0,
    })
    expect(tangentOf(primitiveAt(doc, 0))).toBe(shared)
    expect(tangentOf(primitiveAt(doc, 1))).toBeNull()
    expect(shared?.isDisposed()).toBe(false)
  })

  it('changes nothing more on a second run', () => {
    const doc = docWithPrimitives([{ material: {} }, { material: { normalTexture: true } }])
    dropUnusedTangents(doc)
    const accessors = doc.getRoot().listAccessors()
    const keptTangent = tangentOf(primitiveAt(doc, 1))
    const report = dropUnusedTangents(doc)
    expect(report).toEqual({
      primitivesStripped: 0,
      primitivesKept: 1,
      accessorBytesRemoved: 0,
    })
    expect(doc.getRoot().listAccessors()).toEqual(accessors)
    expect(tangentOf(primitiveAt(doc, 0))).toBeNull()
    expect(tangentOf(primitiveAt(doc, 1))).toBe(keptTangent)
  })
})
