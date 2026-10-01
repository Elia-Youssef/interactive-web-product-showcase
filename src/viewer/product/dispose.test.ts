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
import { readFinishPlan } from '@lib/product'
import type { ProductFinishMaterials } from './finishMaterials'
import { disposeProductScene } from './dispose'

// The disposal is observed through the dispose calls the two passes make:
// the scene traversal disposes what the scene carries, and the finish table
// disposes what the load resolved on top of it. The product owns both, so
// its one release must reach every geometry, material and texture.

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

// The table a load resolves, possibly empty for a file without finishes,
// plus the materials the scene carried at parse time, which the swap may
// have replaced.
function finishesOf(
  entries: readonly [number, ThreeMaterial][],
  sceneMaterials: readonly ThreeMaterial[] = [],
): ProductFinishMaterials {
  return {
    plan: readFinishPlan({}),
    materials: new Map(entries),
    sceneMaterials: new Set(sceneMaterials),
  }
}

function noFinishes(): ProductFinishMaterials {
  return finishesOf([])
}

test('a teardown disposes every geometry, material and texture the scene holds', () => {
  const { parts, disposals } = trackedTree()

  disposeProductScene(parts.root, noFinishes())

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
})

test('the resolved finishes the scene does not carry are disposed with their textures', () => {
  const { parts, disposals } = trackedTree()

  disposeProductScene(parts.root, finishesOf([[1, parts.variantMaterial]]))

  expect(disposals).toContain('variantMaterial')
  expect(disposals).toContain('variantDiffuse')
})

test('a finish applied before teardown is disposed, and the default with it', () => {
  const { parts, disposals } = trackedTree()
  const body = parts.root.children[0]
  if (!(body instanceof Mesh)) {
    throw new Error('the fixture body must be a mesh')
  }
  body.material = parts.variantMaterial

  // The product owns every resolved material, the replaced default
  // included: the release passes the scene and the resolved table, and a
  // material shared by both simply runs through the two passes.
  disposeProductScene(
    parts.root,
    finishesOf([
      [0, parts.bodyMaterial],
      [1, parts.variantMaterial],
    ]),
  )

  expect(disposals).toContain('variantMaterial')
  expect(disposals).toContain('variantDiffuse')
  expect(disposals).toContain('bodyMaterial')
})

test('a load whose meshes were swapped disposes the materials it replaced', () => {
  const { parts, disposals } = trackedTree()
  const body = parts.root.children[0]
  if (!(body instanceof Mesh)) {
    throw new Error('the fixture body must be a mesh')
  }

  // The parse recorded the scene's materials, then the first finish swap
  // replaced the body's on the mesh: the traversal sees only the swapped-in
  // material, and the parse-time record is what still names the swapped-out
  // one. Counting the events pins the whole class: every material the load
  // created goes exactly once, whatever the swaps did to the mesh slots.
  body.material = parts.variantMaterial
  const grilleFirst = parts.grilleMaterials[0]
  if (grilleFirst === undefined) {
    throw new Error('the fixture grille must carry its first material')
  }
  disposeProductScene(
    parts.root,
    finishesOf([[1, parts.variantMaterial]], [parts.bodyMaterial, grilleFirst]),
  )

  // The swapped-out material goes through the record alone, exactly once.
  // The grille's first material is both still applied and recorded, so its
  // two passes both reach it, and three's dispose is idempotent about that.
  expect(disposals.filter((event) => event === 'bodyMaterial')).toHaveLength(1)
  expect(disposals).toContain('grilleMaterial0')
  expect(disposals).toContain('variantMaterial')
})

test('disposing an already disposed scene is safe', () => {
  const parts = productTree()

  disposeProductScene(parts.root, noFinishes())
  expect(() =>
    disposeProductScene(parts.root, finishesOf([[1, parts.variantMaterial]])),
  ).not.toThrow()
})
