import { expect, test } from 'vitest'
import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  type BufferGeometry as Geometry,
  type Material as ThreeMaterial,
  type Texture as ThreeTexture,
} from 'three'
import { disposeProductScene } from './dispose'

// The disposal is observed through the dispose calls the traversal makes:
// every geometry, material and texture the scene holds must be told exactly
// once per run.

function track<T extends { dispose(): void }>(target: T, disposals: string[], label: string): T {
  target.dispose = () => {
    disposals.push(label)
  }
  return target
}

type SceneParts = {
  root: Object3D
  geometryA: Geometry
  geometryB: Geometry
  bodyMaterial: ThreeMaterial
  variantMaterial: ThreeMaterial
  grilleMaterials: ThreeMaterial[]
  diffuse: ThreeTexture
  normal: ThreeTexture
  variantDiffuse: ThreeTexture
  grilleMap: ThreeTexture
}

// The shape the optimize step produces: a part whose mesh moved to an
// unnamed wrapper, and a mesh with a per-group material array.
function productTree(): SceneParts {
  const geometryA = new BufferGeometry()
  const geometryB = new BufferGeometry()
  const diffuse = new Texture()
  const normal = new Texture()
  const variantDiffuse = new Texture()
  const grilleMap = new Texture()

  const bodyMaterial = new MeshStandardMaterial({ map: diffuse, normalMap: normal })
  const variantMaterial = new MeshStandardMaterial({ map: variantDiffuse })
  const grilleMaterials = [new MeshStandardMaterial({ map: grilleMap }), new MeshStandardMaterial()]

  const body = new Mesh(geometryA, bodyMaterial)
  body.name = 'PART_body'
  const wrapper = new Object3D()
  const grille = new Mesh(geometryB, grilleMaterials)
  wrapper.add(grille)

  return {
    root: new Object3D().add(body, wrapper),
    geometryA,
    geometryB,
    bodyMaterial,
    variantMaterial,
    grilleMaterials,
    diffuse,
    normal,
    variantDiffuse,
    grilleMap,
  }
}

function trackedTree() {
  const parts = productTree()
  const disposals: string[] = []
  for (const [label, geometry] of [
    ['geometryA', parts.geometryA],
    ['geometryB', parts.geometryB],
  ] as const) {
    track(geometry, disposals, label)
  }
  track(parts.bodyMaterial, disposals, 'bodyMaterial')
  track(parts.variantMaterial, disposals, 'variantMaterial')
  parts.grilleMaterials.forEach((material, index) => {
    track(material, disposals, `grilleMaterial${index}`)
  })
  for (const [label, texture] of [
    ['diffuse', parts.diffuse],
    ['normal', parts.normal],
    ['variantDiffuse', parts.variantDiffuse],
    ['grilleMap', parts.grilleMap],
  ] as const) {
    track(texture, disposals, label)
  }
  return { parts, disposals }
}

test('a teardown disposes every geometry, material and texture the scene holds', () => {
  const { parts, disposals } = trackedTree()

  disposeProductScene(parts.root)

  expect(disposals).toEqual([
    'geometryA',
    'diffuse',
    'normal',
    'bodyMaterial',
    'geometryB',
    'grilleMap',
    'grilleMaterial0',
    'grilleMaterial1',
  ])
  // The variant material is not part of the scene: it exists only in the
  // variants controller's table, so the scene traversal leaves it alone.
  expect(disposals).not.toContain('variantMaterial')
})

test('a finish applied before teardown is disposed with its textures', () => {
  const { parts, disposals } = trackedTree()
  const body = parts.root.children[0]
  if (!(body instanceof Mesh)) {
    throw new Error('the fixture body must be a mesh')
  }
  body.material = parts.variantMaterial

  disposeProductScene(parts.root)

  expect(disposals).toContain('variantMaterial')
  expect(disposals).toContain('variantDiffuse')
  expect(disposals).not.toContain('bodyMaterial')
})

test('disposing an already disposed scene is safe', () => {
  const parts = productTree()

  disposeProductScene(parts.root)
  expect(() => disposeProductScene(parts.root)).not.toThrow()
})
