import { expect, test } from 'vitest'
import {
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Texture,
  type Vector2,
} from 'three'
import { markSceneMaterials } from './finishMaterials'

// The material preparation the load runs before the node renderer sees a
// material: every instance owns its program cache key, and every anisotropic
// material without a map owns its anisotropy vector as a static value node.
// The ownership is what keeps one material's uniform values from rendering
// under another material: the node renderer otherwise updates the shared
// anisotropy uniform once per material and render, so a render object whose
// own update was skipped reads whichever material refreshed last.

// The structural read of the value node the preparation sets on a classic
// material: the classic type carries no anisotropy node field at all, so the
// untouched materials read back undefined.
type AnisotropyCarrier = Material & { anisotropyNode?: { value?: Vector2 } | null }

function anisotropyValueOf(material: Material): Vector2 | undefined {
  return (material as AnisotropyCarrier).anisotropyNode?.value
}

test('a prepared scene gives every material its own program cache key', () => {
  const scene = new Object3D()
  const steel = new MeshPhysicalMaterial()
  const trim = new MeshPhysicalMaterial()
  scene.add(new Mesh(undefined, steel), new Mesh(undefined, trim))

  markSceneMaterials(scene)

  expect(steel.customProgramCacheKey()).not.toBe(trim.customProgramCacheKey())
})

test('an anisotropic material carries its own vector node, not a shared one', () => {
  const scene = new Object3D()
  const shell = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  shell.anisotropyRotation = Math.PI / 2
  const knurl = new MeshPhysicalMaterial({ anisotropy: 0.6 })
  knurl.anisotropyRotation = Math.PI / 2
  scene.add(new Mesh(undefined, shell), new Mesh(undefined, knurl))

  markSceneMaterials(scene)

  const shellVector = anisotropyValueOf(shell)
  const knurlVector = anisotropyValueOf(knurl)
  expect(shellVector).not.toBe(knurlVector)
  expect(shellVector?.x).toBeCloseTo(0, 12)
  expect(shellVector?.y).toBeCloseTo(0.5, 12)
  expect(knurlVector?.x).toBeCloseTo(0, 12)
  expect(knurlVector?.y).toBeCloseTo(0.6, 12)
})

test('the preparation reaches the materials of a material array', () => {
  const scene = new Object3D()
  const first = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  const second = new MeshStandardMaterial()
  scene.add(new Mesh(undefined, [first, second]))

  markSceneMaterials(scene)

  expect(anisotropyValueOf(first)).toBeDefined()
  expect((second as AnisotropyCarrier).anisotropyNode).toBeUndefined()
})

test('a material without anisotropy and one with a map stay on the shared path', () => {
  const scene = new Object3D()
  const plain = new MeshPhysicalMaterial()
  const mapped = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  mapped.anisotropyMap = new Texture()
  const nothing = new MeshStandardMaterial()
  scene.add(new Mesh(undefined, plain), new Mesh(undefined, mapped), new Mesh(undefined, nothing))

  markSceneMaterials(scene)

  expect(anisotropyValueOf(plain)).toBeUndefined()
  expect(anisotropyValueOf(mapped)).toBeUndefined()
  expect((nothing as AnisotropyCarrier).anisotropyNode).toBeUndefined()
})

test('the preparation is idempotent: a marked material keeps its node and key', () => {
  const scene = new Object3D()
  const steel = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  scene.add(new Mesh(undefined, steel))

  markSceneMaterials(scene)
  const firstKey = steel.customProgramCacheKey()
  const firstNode = anisotropyValueOf(steel)
  markSceneMaterials(scene)

  expect(steel.customProgramCacheKey()).toBe(firstKey)
  expect(anisotropyValueOf(steel)).toBe(firstNode)
})
