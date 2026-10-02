import { Mesh, type Object3D } from 'three'
import { expect, test } from 'vitest'
import {
  finishEntryMaterialIndexes,
  finishMaterialIndex,
  type FinishPrimitivePlan,
} from '@lib/product'
import { mappedSceneMeshes } from './mappedMeshes'
import { applyFinish, resolvedMaterial } from './applyFinish'
import { applyFirstFinish } from './firstFinishApplication'
import {
  dualPrimitives,
  expectDerivationFlags,
  namedMesh,
  parsedLoad,
  singleStandard,
  VARIANTS,
} from './finishDerivation.fixtures'

// The derivation class, against the real loader in Node: the fixture of
// finishDerivation.fixtures.ts, parsed by GLTFLoader with the product's own
// resolver plugin, then dressed through the feature's apply and first
// application. The contract: what a mesh shows for a finish is the loader's
// own derivation of that mesh from the variant's raw material, never the
// raw material and never a derivation of a derivation; and the load-time
// precompile covers exactly the pairs each mesh does not carry yet. The
// first test here is the fixture's own contract: the tables the class
// reasons over are the tables the fixture built.

test('the fixture parses with the variants, meshes and shared raws its tables declare', async () => {
  const { loaded } = await parsedLoad()

  expect(loaded.finishes.plan.variants).toEqual([...VARIANTS])
  const mapped = mappedSceneMeshes(loaded)
  // Six mapped parts over seven mapped primitive nodes: the two-primitive
  // mesh contributes two.
  expect(new Set(mapped.map(({ entry }) => entry.mesh)).size).toBe(6)
  expect(mapped).toHaveLength(7)
  const dual = dualPrimitives(loaded)
  expect(dual.zero.entry.defaultMaterial).not.toBe(dual.one.entry.defaultMaterial)

  // flat2 wears flat's raws with its default and sage swapped, the shape
  // the precompile's per-mesh skip is held against.
  const entries = new Map(mapped.map(({ mesh, entry }) => [mesh.name, entry]))
  const flat = entries.get('PART_flat')
  const flat2 = entries.get('PART_flat2')
  if (flat === undefined || flat2 === undefined) {
    throw new Error('the fixture must map both flat meshes')
  }
  expect(flat2.defaultMaterial).toBe(flat.variantMaterials.get(0))
  expect(flat2.variantMaterials.get(0)).toBe(flat.defaultMaterial)
})

test('at load, the derived default of each mapped mesh is the clone the loader put on it', async () => {
  const { loaded } = await parsedLoad()

  for (const { mesh, entry } of mappedSceneMeshes(loaded)) {
    const defaultIndex = entry.defaultMaterial
    if (defaultIndex === null) {
      throw new Error('the fixture maps a primitive that names no default material')
    }
    const defaultMaterial = resolvedMaterial(loaded, entry, defaultIndex)
    expect(defaultMaterial, `the table default of '${mesh.name}'`).toBe(mesh.material)
    expect(
      loaded.finishes.sceneMaterials.has(defaultMaterial),
      `the parse-time record names the material of '${mesh.name}'`,
    ).toBe(true)
  }
})

test('the loader derived, per mesh, the flags its geometry asks for', async () => {
  const { loaded } = await parsedLoad()

  const tangent = singleStandard(namedMesh(loaded, 'PART_tangent'))
  expect(tangent.normalScale.y, 'the mesh with a TANGENT keeps its normalScale upright').toBe(1)
  const plain = singleStandard(namedMesh(loaded, 'PART_plain'))
  expect(plain.normalScale.y, 'the tangent-less mesh carries the flipped clone').toBe(-1)
  const colored = singleStandard(namedMesh(loaded, 'PART_colored'))
  expect(colored.vertexColors, 'the COLOR_0 mesh carries vertex colors').toBe(true)
  const flat = singleStandard(namedMesh(loaded, 'PART_flat'))
  expect(flat.flatShading, 'the mesh without normals carries flat shading').toBe(true)
  const flat2 = singleStandard(namedMesh(loaded, 'PART_flat2'))
  expect(flat2.flatShading, 'the second flat mesh carries flat shading').toBe(true)
})

test('after each variant, every mapped mesh wears the derivation the loader makes for it', async () => {
  const { loaded, loaderDerives } = await parsedLoad()

  for (const [variantIndex, variant] of VARIANTS.entries()) {
    await applyFinish({ loaded, variant, settle: () => Promise.resolve() })
    for (const { mesh, entry } of mappedSceneMeshes(loaded)) {
      const index = finishMaterialIndex(entry, variantIndex)
      expect(mesh.material, `the material of '${mesh.name}' under '${variant}'`).toBe(
        loaderDerives(mesh, index),
      )
      expectDerivationFlags(mesh, singleStandard(mesh))
    }
  }
})

test('a two-primitive mapped mesh dresses each primitive in its own derivation', async () => {
  const { loaded, loaderDerives } = await parsedLoad()
  const dual = dualPrimitives(loaded)

  for (const [variantIndex, variant] of VARIANTS.entries()) {
    await applyFinish({ loaded, variant, settle: () => Promise.resolve() })
    for (const node of [dual.zero, dual.one]) {
      const index = finishMaterialIndex(node.entry, variantIndex)
      expect(node.mesh.material, `its primitive ${node.entry.primitive} under '${variant}'`).toBe(
        loaderDerives(node.mesh, index),
      )
    }
  }
  // The two primitives map different raws, so the same variant dresses
  // them in two materials.
  expect(dual.zero.mesh.material).not.toBe(dual.one.mesh.material)
})

test('one raw material derives once per mesh: shared, flipped, colored, flat', async () => {
  const { loaded, loaderDerives } = await parsedLoad()
  const entries = new Map<string, FinishPrimitivePlan>(
    mappedSceneMeshes(loaded).map(({ mesh, entry }) => [mesh.name, entry]),
  )

  await applyFinish({ loaded, variant: 'sage', settle: () => Promise.resolve() })

  const plainEntry = entries.get('PART_plain')
  const coloredEntry = entries.get('PART_colored')
  const tangentEntry = entries.get('PART_tangent')
  if (plainEntry === undefined || coloredEntry === undefined || tangentEntry === undefined) {
    throw new Error('the fixture scene must map the plain, colored and tangent meshes')
  }
  const sharedIndex = finishMaterialIndex(plainEntry, 0)
  const sharedRaw = loaded.finishes.rawMaterials.get(sharedIndex)
  if (sharedRaw === undefined) {
    throw new Error('the load resolved no raw material behind the shared sage index')
  }

  const plainSage = singleStandard(namedMesh(loaded, 'PART_plain'))
  const coloredSage = singleStandard(namedMesh(loaded, 'PART_colored'))
  const tangentSage = singleStandard(namedMesh(loaded, 'PART_tangent'))

  // One raw material, two per-mesh derivations: the plain clone flips the
  // normalScale, the colored clone adds vertex colors, and neither is the
  // raw material or the other clone.
  expect(plainSage, 'the plain derivation is the loader clone of the shared raw').toBe(
    loaderDerives(namedMesh(loaded, 'PART_plain'), sharedIndex),
  )
  expect(coloredSage, 'the colored derivation is its own clone of the shared raw').toBe(
    loaderDerives(namedMesh(loaded, 'PART_colored'), sharedIndex),
  )
  expect(plainSage).not.toBe(coloredSage)
  expect(plainSage).not.toBe(sharedRaw)
  expect(coloredSage).not.toBe(sharedRaw)
  expect(plainSage.normalScale.y).toBe(-1)
  expect(coloredSage.vertexColors).toBe(true)

  // Where the geometry asks for no clone, the derivation is an identity:
  // the tangent mesh wears the raw material itself.
  const tangentIndex = finishMaterialIndex(tangentEntry, 0)
  expect(tangentSage).toBe(loaded.finishes.rawMaterials.get(tangentIndex))
  expect(tangentSage.normalScale.y).toBe(1)
})

test('the first application precompiles exactly the pairs each mesh does not carry', async () => {
  const { loaded } = await parsedLoad()

  for (const variant of VARIANTS) {
    let group: Object3D | undefined
    await applyFirstFinish({
      loaded,
      variant,
      settle: () => {
        group = loaded.scene.children.find((child) => child.name === 'FINISH_precompile')
        return Promise.resolve()
      },
    })
    if (group === undefined) {
      throw new Error(`the first application of '${variant}' built no precompile group`)
    }
    const proxies = new Map<string, number>()
    for (const child of group.children) {
      if (!(child instanceof Mesh) || Array.isArray(child.material)) {
        throw new Error('the precompile group holds a child that is no proxy')
      }
      const key = `${child.geometry.uuid}:${child.material.uuid}`
      proxies.set(key, (proxies.get(key) ?? 0) + 1)
    }
    const expected = new Map<string, number>()
    for (const { mesh, entry } of mappedSceneMeshes(loaded)) {
      for (const materialIndex of finishEntryMaterialIndexes(entry)) {
        const derived = resolvedMaterial(loaded, entry, materialIndex)
        if (mesh.material === derived) {
          continue
        }
        const key = `${mesh.geometry.uuid}:${derived.uuid}`
        expected.set(key, (expected.get(key) ?? 0) + 1)
      }
    }
    expect(proxies, `the precompile proxies under '${variant}'`).toEqual(expected)
    expect(
      loaded.scene.children.some((child) => child.name === 'FINISH_precompile'),
      'the precompile group leaves with the application',
    ).toBe(false)
  }
})
