// The drifts only the real loader can see, over fixture documents: the
// morph displacement widening, a points primitive, and the normalize
// arithmetic. The shipped-product agreement they protect lives in
// productAgreement.test.ts; this file pins what a proof built on a
// reconstructed tree would miss.
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildThreeTree } from './productScene'
import { parseGltfWithLoader } from './productGltf'
import { createModelIO } from '../../scripts/modelIo.ts'
import { readCameraFacts, readMeshBoxes } from '../../scripts/modelFacts.ts'
import { measureModelFrame } from '../../src/viewer/modelFrame'
import { frameSpanOfMeshBoxes } from '../../src/lib/camera/frame.ts'
import { buildDocument, vec3Accessor } from '../../scripts/validateFixtures.ts'
import type { Document } from '@gltf-transform/core'

let modelIO: ReturnType<typeof createModelIO> | null = null
function modelIOSoon(): ReturnType<typeof createModelIO> {
  modelIO ??= createModelIO()
  return modelIO
}

describe('the camera facts normalize like three, on random directions', () => {
  it('reads the same forward as three for a hundred random camera rotations', () => {
    for (let i = 0; i < 100; i += 1) {
      const rotation = new Quaternion().random()
      const doc = buildDocument({
        cameraPose: {
          position: [0.5, 0.25, 1.5],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          fovYDegrees: 30,
          aspect: null,
        },
      })
      const fact = readCameraFacts(doc).find((candidate) => candidate.name === 'CAM_home')
      if (fact === undefined || fact.ray === null) {
        throw new Error('the fixture home camera fact is missing')
      }
      const camera = new PerspectiveCamera()
      camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      const three = camera.getWorldDirection(new Vector3())
      expect([three.x, three.y, three.z]).toEqual(fact.ray.forward)
    }
  })
})

describe('the real loader against the geometry classes the contract bans', () => {
  const fixtureDirs: string[] = []

  // A fixture document written to a .glb, with one shape grafted onto the
  // first part's primitive.
  async function writeFixtureGltf(graft: (doc: Document) => void): Promise<string> {
    const doc = buildDocument({ hotspotNames: [], meshopt: false })
    graft(doc)
    const dir = await mkdtemp(path.join(tmpdir(), 'geometry-fixture-'))
    fixtureDirs.push(dir)
    const modelPath = path.join(dir, 'model.glb')
    const io = await createModelIO()
    await io.write(modelPath, doc)
    return modelPath
  }

  it('frames a morph target wider than the document facts, which the reconstructed tree cannot see', async () => {
    const modelPath = await writeFixtureGltf((doc) => {
      const primitive = doc
        .getRoot()
        .listNodes()
        .find((node) => node.getName() === 'PART_base')
        ?.getMesh()
        ?.listPrimitives()[0]
      if (primitive === undefined) {
        throw new Error('the fixture mesh is missing')
      }
      const target = doc.createPrimitiveTarget()
      target.setAttribute('POSITION', vec3Accessor(doc, [0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0]))
      primitive.addTarget(target)
    })
    const doc = await (await modelIOSoon()).read(modelPath)
    const documentFrame = frameSpanOfMeshBoxes(readMeshBoxes(doc))
    const parsed = await parseGltfWithLoader(modelPath)
    const loaderFrame = measureModelFrame(parsed.scene)
    // The loader widens the box by the morph displacement, and the
    // document facts widen by the same displacement: one frame, which is
    // why the class is a contract matter at all.
    expect(loaderFrame.radius).toBe(documentFrame.radius)
    expect(loaderFrame.radius).toBeGreaterThan(2)
    // The reconstructed tree reads no morph targets: a proof built on it
    // would measure the unwidened frame here and see no drift.
    const reconstructedFrame = measureModelFrame(buildThreeTree(doc))
    expect(reconstructedFrame.radius).not.toBe(loaderFrame.radius)
    expect(reconstructedFrame.radius).toBeLessThan(loaderFrame.radius)
  })

  it('frames a points primitive the same way the document facts do', async () => {
    const modelPath = await writeFixtureGltf((doc) => {
      const scene = doc.getRoot().listScenes()[0]
      if (scene === undefined) {
        throw new Error('the fixture scene is missing')
      }
      const mesh = doc.createMesh('PART_dots')
      const primitive = doc.createPrimitive().setMode(0)
      primitive.setAttribute('POSITION', vec3Accessor(doc, [0, 0, 0, 1, 1, 1]))
      mesh.addPrimitive(primitive)
      scene.addChild(doc.createNode('PART_dots').setMesh(mesh))
    })
    const doc = await (await modelIOSoon()).read(modelPath)
    const documentFrame = frameSpanOfMeshBoxes(readMeshBoxes(doc))
    const parsed = await parseGltfWithLoader(modelPath)
    const loaderFrame = measureModelFrame(parsed.scene)
    // Points are objects with geometry, the set three's Box3 selects, and
    // the runtime frame selects the same set.
    expect(loaderFrame.centerX).toBe(documentFrame.center[0])
    expect(loaderFrame.centerY).toBe(documentFrame.center[1])
    expect(loaderFrame.centerZ).toBe(documentFrame.center[2])
    expect(loaderFrame.radius).toBe(documentFrame.radius)
    expect(loaderFrame.meshes).toBe(4)
  })

  it('leaves no fixture files behind', async () => {
    for (const dir of fixtureDirs) {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
