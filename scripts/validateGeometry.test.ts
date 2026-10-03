// The model contract check, over contract documents built in memory: one
// case per geometry class the site cannot present, each asserting the exact
// violation, and the plain contract document passing.
import { describe, expect, it } from 'vitest'
import { EXTMeshGPUInstancing } from '@gltf-transform/extensions'
import type { Document } from '@gltf-transform/core'
import { readProductStructure } from './structure.ts'
import { buildDocument, vec3Accessor } from './validateFixtures.ts'
import { checkGeometry } from './validateChecks.ts'

function quadIndices(doc: Document) {
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

// Adds one more mesh of the given shape to the fixture document, so every
// case counts one grafted primitive beside the three the base carries.
function addMesh(
  doc: Document,
  name: string,
  build: (primitive: ReturnType<Document['createPrimitive']>) => void,
  mode: 0 | 4 = 4,
): void {
  const mesh = doc.createMesh(name)
  const primitive = doc.createPrimitive().setMode(mode)
  build(primitive)
  mesh.addPrimitive(primitive)
  const node = doc.createNode(name).setMesh(mesh)
  doc.getRoot().listScenes()[0]?.addChild(node)
}

describe('the geometry contract check', () => {
  it('passes on the plain contract document', () => {
    const result = checkGeometry(readProductStructure(buildDocument()))
    expect(result.status).toBe('pass')
    expect(result.violations).toEqual([])
  })

  it('reports a points primitive', () => {
    const doc = buildDocument()
    addMesh(
      doc,
      'PART_dots',
      (primitive) => {
        primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0]))
      },
      0,
    )
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['1 of 4 primitives are not triangles'])
  })

  it('reports a primitive without positions', () => {
    const doc = buildDocument()
    addMesh(doc, 'PART_hollow', (primitive) => {
      primitive.setIndices(quadIndices(doc))
    })
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['1 of 4 primitives carry no positions'])
  })

  it('reports morph targets', () => {
    const doc = buildDocument()
    addMesh(doc, 'PART_morph', (primitive) => {
      primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]))
      primitive.setIndices(quadIndices(doc))
      const target = doc.createPrimitiveTarget()
      target.setAttribute('POSITION', vec3Accessor(doc, [0, 2, 0, 1, 2, 0, 0, 3, 0, 1, 3, 0]))
      primitive.addTarget(target)
    })
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['1 of 4 primitives carry morph targets'])
  })

  it('reports a skin', () => {
    const doc = buildDocument()
    const joint = doc.getRoot().listNodes()[0]
    if (joint === undefined) {
      throw new Error('the fixture scene holds no node to joint')
    }
    const skin = doc.createSkin('wobble')
    skin.addJoint(joint)
    doc.getRoot().listScenes()[0]?.addChild(doc.createNode('skinned').setSkin(skin))
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['the model carries 1 skins'])
  })

  it('reports instancing', () => {
    const doc = buildDocument()
    doc.createExtension(EXTMeshGPUInstancing)
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['the model carries EXT_mesh_gpu_instancing'])
  })

  it('reports a second scene', () => {
    const doc = buildDocument()
    doc.createScene('Two')
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['expected exactly one scene, found 2'])
  })

  it('reports a node outside the scene', () => {
    const doc = buildDocument()
    doc.createNode('ORPHAN')
    const result = checkGeometry(readProductStructure(doc))
    expect(result.violations).toEqual(['node ORPHAN sits outside the scene'])
  })
})
