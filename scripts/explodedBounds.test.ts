// The document-side exploded bounds: every PART_-owned mesh posed by its
// channels' last key, the shadow subtree excluded, through the same frame
// math the runtime's posed scene feeds. The reader is the build-time half
// of the home view's reach rule at the explode's end.
import { describe, expect, it } from 'vitest'
import { Document } from '@gltf-transform/core'
import { readAnimationFacts } from './animationFacts.ts'
import { explodedBoundsOf } from './explodedBounds.ts'
import { vec3Accessor } from './validateFixtures.ts'

// A document with one part mesh node named PART_base, at the translation
// the case sets, plus whatever extra nodes the case grafts.
function documentWith(translation: readonly number[] = [0, 0, 0]): Document {
  const doc = new Document()
  doc.createBuffer()
  doc.createScene('Scene')
  const mesh = doc.createMesh('base')
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0])),
  )
  doc
    .getRoot()
    .listScenes()[0]
    ?.addChild(
      doc
        .createNode('PART_base')
        .setMesh(mesh)
        .setTranslation([translation[0] ?? 0, translation[1] ?? 0, translation[2] ?? 0]),
    )
  return doc
}

// A translation channel on the part: times [0, 1], values rest then end.
function addChannel(
  doc: Document,
  values: readonly number[],
  interpolation: 'LINEAR' | 'CUBICSPLINE' = 'LINEAR',
): void {
  const animation = doc.createAnimation('Explode')
  const sampler = doc.createAnimationSampler().setInterpolation(interpolation)
  sampler.setInput(
    doc
      .createAccessor()
      .setType('SCALAR')
      .setArray(new Float32Array([0, 1]))
      .setBuffer(doc.getRoot().listBuffers()[0] ?? doc.createBuffer()),
  )
  sampler.setOutput(vec3Accessor(doc, [...values]))
  animation.addSampler(sampler)
  const channel = doc.createAnimationChannel()
  channel.setSampler(sampler)
  channel.setTargetNode(
    doc
      .getRoot()
      .listNodes()
      .find((node) => node.getName() === 'PART_base') ?? null,
  )
  channel.setTargetPath('translation')
  animation.addChannel(channel)
}

describe('explodedBoundsOf', () => {
  it("poses the part mesh boxes at the channels' last key", () => {
    const doc = documentWith()
    addChannel(doc, [0, 0, 0, 0, 3, 0])
    const bounds = explodedBoundsOf(doc, readAnimationFacts(doc))
    // The quad lifts to y 3: x and z stay the quad's own extents.
    expect(bounds).toEqual({ min: [0, 3, 0], max: [1, 4, 0] })
  })

  it('keeps a part with no channel at its rest pose', () => {
    const doc = documentWith([2, 0, 0])
    const bounds = explodedBoundsOf(doc, readAnimationFacts(doc))
    expect(bounds).toEqual({ min: [2, 0, 0], max: [3, 1, 0] })
  })

  it('excludes the shadow subtree and meshes no part owns', () => {
    const doc = documentWith()
    const scene = doc.getRoot().listScenes()[0]
    if (scene === undefined) {
      throw new Error('the fixture scene is missing')
    }
    const shadowMesh = doc.createMesh('shadow')
    shadowMesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', vec3Accessor(doc, [-9, -9, 0, 9, -9, 0, -9, 9, 0, 9, 9, 0])),
    )
    const shadow = doc.createNode('SHADOW').setMesh(shadowMesh)
    const strayMesh = doc.createMesh('stray')
    strayMesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 0, 0, 9, 0, 9, 0, 0, 9, 9])),
    )
    scene.addChild(shadow)
    scene.addChild(doc.createNode('unowned').setMesh(strayMesh))
    addChannel(doc, [0, 0, 0, 0, 1, 0])

    const bounds = explodedBoundsOf(doc, readAnimationFacts(doc))
    expect(bounds).toEqual({ min: [0, 1, 0], max: [1, 2, 0] })
  })

  it('returns null when no part owns a mesh', () => {
    const doc = new Document()
    doc.createScene('Scene')
    expect(explodedBoundsOf(doc, readAnimationFacts(doc))).toBeNull()
  })

  it('scales a normalized output accessor back to the values the runtime applies', () => {
    const doc = documentWith()
    const animation = doc.createAnimation('Explode')
    const sampler = doc.createAnimationSampler().setInterpolation('LINEAR')
    const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer()
    sampler.setInput(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Float32Array([0, 1]))
        .setBuffer(buffer),
    )
    // Two int16 keys, rest and one unit up, stored normalized: the reader
    // must read them the way the loader would (times the component scale).
    sampler.setOutput(
      doc
        .createAccessor()
        .setType('VEC3')
        .setNormalized(true)
        .setArray(new Int16Array([0, 0, 0, 0, 32767, 0]))
        .setBuffer(buffer),
    )
    animation.addSampler(sampler)
    const channel = doc.createAnimationChannel()
    channel.setSampler(sampler)
    channel.setTargetNode(
      doc
        .getRoot()
        .listNodes()
        .find((node) => node.getName() === 'PART_base') ?? null,
    )
    channel.setTargetPath('translation')
    animation.addChannel(channel)

    const bounds = explodedBoundsOf(doc, readAnimationFacts(doc))
    expect(bounds).toEqual({ min: [0, 1, 0], max: [1, 2, 0] })
  })

  it('reads a CUBICSPLINE track by its key values, tangents aside', () => {
    const doc = documentWith()
    // Cubic spline output carries in-tangent, value, out-tangent per key:
    // the values below keep the pose at rest in the first key and lift it
    // one unit in the second, with nonzero tangents that must not enter.
    const animation = doc.createAnimation('Explode')
    const sampler = doc.createAnimationSampler().setInterpolation('CUBICSPLINE')
    const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer()
    sampler.setInput(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Float32Array([0, 1]))
        .setBuffer(buffer),
    )
    sampler.setOutput(
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array([7, 7, 7, 0, 0, 0, 7, 7, 7, 7, 7, 7, 0, 1, 0, 7, 7, 7]))
        .setBuffer(buffer),
    )
    animation.addSampler(sampler)
    const channel = doc.createAnimationChannel()
    channel.setSampler(sampler)
    channel.setTargetNode(
      doc
        .getRoot()
        .listNodes()
        .find((node) => node.getName() === 'PART_base') ?? null,
    )
    channel.setTargetPath('translation')
    animation.addChannel(channel)

    const bounds = explodedBoundsOf(doc, readAnimationFacts(doc))
    expect(bounds).toEqual({ min: [0, 1, 0], max: [1, 2, 0] })
  })
})
