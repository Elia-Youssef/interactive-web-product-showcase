// The draw-call counter, against its definition: one mesh primitive
// instance in the scene. The cases pin the two parts of that sentence: a
// mesh's primitives each count, and every node instance of a mesh counts.
import { Document, type Node as GltfNode } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { countDrawCalls } from './drawCalls.ts'

function vec3Accessor(doc: Document, values: number[]): ReturnType<Document['createAccessor']> {
  const accessor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(values))
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function quadIndices(doc: Document): ReturnType<Document['createAccessor']> {
  const accessor = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
  const buffer = doc.getRoot().listBuffers()[0]
  if (buffer !== undefined) {
    accessor.setBuffer(buffer)
  }
  return accessor
}

function addSceneNode(doc: Document, node: GltfNode): GltfNode {
  const scene = doc.getRoot().listScenes()[0]
  if (scene === undefined) {
    throw new Error('the fixture scene is missing')
  }
  scene.addChild(node)
  return node
}

// A mesh with the given number of primitives, on a scene-root node.
function addPartMesh(doc: Document, name: string, primitiveCount: number): GltfNode {
  const mesh = doc.createMesh(name)
  for (let index = 0; index < primitiveCount; index += 1) {
    const primitive = doc.createPrimitive()
    primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]))
    primitive.setIndices(quadIndices(doc))
    mesh.addPrimitive(primitive)
  }
  return addSceneNode(doc, doc.createNode(name).setMesh(mesh))
}

function emptyDocument(): Document {
  const doc = new Document()
  doc.createBuffer()
  doc.createScene('Scene')
  return doc
}

describe('the draw-call count', () => {
  it('counts every primitive of a mesh', () => {
    const doc = emptyDocument()
    addPartMesh(doc, 'PART_base', 3)
    expect(countDrawCalls(doc)).toBe(3)
  })

  it('counts one empty node and one childless meshless node as nothing', () => {
    const doc = emptyDocument()
    addSceneNode(doc, doc.createNode('CAM_home').setCamera(doc.createCamera('home')))
    addSceneNode(doc, doc.createNode('HS_driver'))
    expect(countDrawCalls(doc)).toBe(0)
  })

  it('counts a mesh once per node that instances it', () => {
    const doc = emptyDocument()
    const shared = addPartMesh(doc, 'PART_shared', 2)
    const wrapper = addSceneNode(doc, doc.createNode('PART_wrapper'))
    wrapper.addChild(doc.createNode('PART_copy').setMesh(shared.getMesh()))
    // Two node instances of one two-primitive mesh.
    expect(countDrawCalls(doc)).toBe(4)
  })

  it('ignores meshes that no scene carries', () => {
    const doc = emptyDocument()
    doc.createMesh('unattached').addPrimitive(doc.createPrimitive())
    expect(countDrawCalls(doc)).toBe(0)
  })
})
