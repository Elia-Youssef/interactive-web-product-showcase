import { expect, test } from 'vitest'
import {
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Texture,
  type Vector2,
} from 'three/webgpu'
import { markSceneMaterials } from './finishMaterials'

// What the preparation marks on each material instance: its own anisotropy
// value node, in the polar form the renderer's node material reads, and its
// own program cache key, the per-material input the renderer's material
// cache key starts from. The builder-level behavior these marks buy, that
// two materials which differ only in anisotropy sample different values in
// their built programs, is proven through the real node builder in
// finishMaterialsBuild.test.ts.

// The structural reads of the fields the preparation sets: the classic
// material type does not declare them, but the renderer reads them from the
// material's own properties.
type AnisotropyCarrier = Material & {
  anisotropyNode?: { value?: Vector2 }
  customProgramCacheKey?: () => string
}

function anisotropyNodeOf(material: Material): { value?: Vector2 } | undefined {
  return (material as AnisotropyCarrier).anisotropyNode
}

function programCacheKeyOf(material: Material): string | undefined {
  return (material as AnisotropyCarrier).customProgramCacheKey?.()
}

test('every prepared material carries its own anisotropy value node', () => {
  const shell = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  shell.anisotropyRotation = Math.PI / 2
  const knurl = new MeshPhysicalMaterial({ anisotropy: 0.6 })
  knurl.anisotropyRotation = Math.PI / 2
  const scene = new Object3D()
  scene.add(new Mesh(undefined, shell), new Mesh(undefined, knurl))

  markSceneMaterials(scene)

  const shellNode = anisotropyNodeOf(shell)
  const knurlNode = anisotropyNodeOf(knurl)
  expect(shellNode).toBeDefined()
  expect(knurlNode).toBeDefined()
  expect(shellNode).not.toBe(knurlNode)
  expect(shellNode?.value?.x).toBeCloseTo(0, 12)
  expect(shellNode?.value?.y).toBeCloseTo(0.5, 12)
  expect(knurlNode?.value?.x).toBeCloseTo(0, 12)
  expect(knurlNode?.value?.y).toBeCloseTo(0.6, 12)
})

test('every prepared material carries its own program cache key', () => {
  const steel = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  const trim = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  const plain = new MeshPhysicalMaterial()
  const scene = new Object3D()
  scene.add(new Mesh(undefined, steel), new Mesh(undefined, trim), new Mesh(undefined, plain))

  markSceneMaterials(scene)

  expect(programCacheKeyOf(steel)).not.toBe(programCacheKeyOf(trim))
  expect(programCacheKeyOf(steel)).not.toBe(programCacheKeyOf(plain))
})

test('the preparation reaches the materials of a material array', () => {
  const first = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  const second = new MeshStandardMaterial()
  const scene = new Object3D()
  scene.add(new Mesh(undefined, [first, second]))

  markSceneMaterials(scene)

  expect(anisotropyNodeOf(first)).toBeDefined()
  expect(programCacheKeyOf(first)).toBeDefined()
  expect(programCacheKeyOf(second)).toBeDefined()
  expect(anisotropyNodeOf(second)).toBeUndefined()
})

test('an anisotropy texture still gets the ownership key, and no anisotropy value node', () => {
  const mapped = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  mapped.anisotropyRotation = Math.PI / 2
  const anisotropyMap = new Texture()
  mapped.anisotropyMap = anisotropyMap
  const scene = new Object3D()
  scene.add(new Mesh(undefined, mapped))

  markSceneMaterials(scene)

  expect(anisotropyNodeOf(mapped)).toBeUndefined()
  expect(programCacheKeyOf(mapped)).toBeDefined()
  expect(mapped.anisotropy).toBe(0.5)
  expect(mapped.anisotropyRotation).toBe(Math.PI / 2)
  expect(mapped.anisotropyMap).toBe(anisotropyMap)
})

test('the preparation is idempotent: a marked material keeps its node and key', () => {
  const steel = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  const scene = new Object3D()
  scene.add(new Mesh(undefined, steel))

  markSceneMaterials(scene)
  const firstKey = programCacheKeyOf(steel)
  const firstNode = anisotropyNodeOf(steel)
  markSceneMaterials(scene)

  expect(programCacheKeyOf(steel)).toBe(firstKey)
  expect(anisotropyNodeOf(steel)).toBe(firstNode)
})
