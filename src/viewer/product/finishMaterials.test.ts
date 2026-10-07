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

// What the material preparation guarantees to the renderer: every anisotropic
// material a product carries renders its own anisotropy vector, from a value
// node of its own, and no two material instances share a builder state. The
// guarantee is what keeps one material's uniform values from rendering under
// another material: the renderer dedupes builder states by feature flags
// alone, and a shared state carries the first material's value nodes for
// every sharer.

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

test('no two prepared materials share a builder state', () => {
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
  expect(anisotropyNodeOf(second)).toBeUndefined()
})

test('a material with an anisotropy texture is rejected at the validate boundary and left alone here', () => {
  const mapped = new MeshPhysicalMaterial({ anisotropy: 0.5 })
  mapped.anisotropyMap = new Texture()
  const scene = new Object3D()
  scene.add(new Mesh(undefined, mapped))

  markSceneMaterials(scene)

  expect(anisotropyNodeOf(mapped)).toBeUndefined()
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
