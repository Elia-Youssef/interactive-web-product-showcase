import { AnimationClip, Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import { parseProduct, readFinishPlan, type FinishPlan } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { GltfAssociation } from '@viewer/product/mappedSceneNodes'
import type { FinishApplierOwner } from './finishApplier'

// The fake world the applier's tests drive: a loaded product with three
// mapped meshes and a settle whose promises the test resolves by hand, so
// every ordering claim in the tests is made by the test's own hand, never
// by a wait.

export const SAGE = 'sage'
export const GRAPHITE = 'graphite'

// One mapped primitive's glTF fixture: its default material and one mapping
// per material and variant list.
type PrimitiveMapping = { readonly material: number; readonly variants: readonly number[] }

function mappedPrimitive(defaultMaterial: number, ...mappings: PrimitiveMapping[]): unknown {
  return {
    material: defaultMaterial,
    extensions: {
      KHR_materials_variants: { mappings },
    },
  }
}

// A plan over three mapped meshes: the shell and the trim carry one
// material per variant, the grille one material shared by both.
export function plan(): FinishPlan {
  return readFinishPlan({
    extensions: {
      KHR_materials_variants: { variants: [{ name: SAGE }, { name: GRAPHITE }] },
    },
    materials: [
      { name: 'MAT_shell_sage' },
      { name: 'MAT_shell_graphite' },
      { name: 'MAT_grille' },
      { name: 'MAT_trim_sage' },
      { name: 'MAT_trim_graphite' },
    ],
    meshes: [
      {
        name: 'PART_shell',
        primitives: [
          mappedPrimitive(0, { material: 0, variants: [0] }, { material: 1, variants: [1] }),
        ],
      },
      {
        name: 'PART_grille',
        primitives: [mappedPrimitive(2, { material: 2, variants: [0, 1] })],
      },
      {
        name: 'PART_trim',
        primitives: [
          mappedPrimitive(3, { material: 3, variants: [0] }, { material: 4, variants: [1] }),
        ],
      },
    ],
  })
}

// One fake load: three mapped meshes on a scene, the associations the
// loader would record, and the plan's materials resolved.
export function fakeLoad(): {
  loaded: LoadedProduct
  shell: Mesh
  grille: Mesh
  trim: Mesh
  materials: readonly [Material, Material, Material, Material, Material]
} {
  const materials = [
    new MeshStandardMaterial({ name: 'MAT_shell_sage' }),
    new MeshStandardMaterial({ name: 'MAT_shell_graphite' }),
    new MeshStandardMaterial({ name: 'MAT_grille' }),
    new MeshStandardMaterial({ name: 'MAT_trim_sage' }),
    new MeshStandardMaterial({ name: 'MAT_trim_graphite' }),
  ] as const
  const scene = fakeScene(materials)

  return {
    loaded: {
      manifest: parseProduct(sampleOneManifest, 'fixture'),
      scene: scene.group,
      rig: {
        parts: new Map(),
        hotspots: [],
        cameras: new Map(),
        shadow: scene.group,
        clip: new AnimationClip('Explode', 1, []),
        variants: [SAGE, GRAPHITE],
      },
      parser: {
        json: {},
        associations: scene.associations,
        getDependency: () => Promise.resolve(null),
      },
      finishes: {
        plan: plan(),
        materials: new Map(materials.map((material, index) => [index, material])),
        // What the parse would have recorded: the three materials the fake
        // scene's meshes carry.
        sceneMaterials: new Set([materials[0], materials[2], materials[3]]),
      },
    },
    shell: scene.shell,
    grille: scene.grille,
    trim: scene.trim,
    materials,
  }
}

// The fake scene: the mapped meshes dressed in the plan's defaults, with
// the associations the loader records for them.
function fakeScene(materials: readonly [Material, Material, Material, Material, Material]): {
  group: Group
  shell: Mesh
  grille: Mesh
  trim: Mesh
  associations: Map<object, GltfAssociation>
} {
  const shell = new Mesh()
  shell.name = 'PART_shell'
  shell.material = materials[0]
  const grille = new Mesh()
  grille.name = 'PART_grille'
  grille.material = materials[2]
  const trim = new Mesh()
  trim.name = 'PART_trim'
  trim.material = materials[3]
  const group = new Group()
  group.add(shell, grille, trim)

  const associations = new Map<object, GltfAssociation>()
  associations.set(shell, { meshes: 0, primitives: 0 })
  associations.set(grille, { meshes: 1, primitives: 0 })
  associations.set(trim, { meshes: 2, primitives: 0 })
  return { group, shell, grille, trim, associations }
}

// The fake settle: each call records whether the scene carried the
// precompile proxies at that moment, then parks until the test releases it.
export function fakeSettle(world: { readonly loaded: LoadedProduct }): {
  settle: () => Promise<void>
  settleCalls: () => number
  // Whether the scene carried the precompile proxies when each settle was
  // called: the load-time precompile rides the first settle only.
  precompiledAtSettle: () => readonly boolean[]
  releaseAll: () => void
} {
  const pending: (() => void)[] = []
  const precompiled: boolean[] = []
  return {
    settle: () => {
      precompiled.push(
        world.loaded.scene.children.some((child) => child.name === 'FINISH_precompile'),
      )
      return new Promise<void>((resolve) => {
        pending.push(resolve)
      })
    },
    settleCalls: () => precompiled.length,
    precompiledAtSettle: () => precompiled,
    releaseAll: () => {
      for (const release of pending.splice(0)) {
        release()
      }
    },
  }
}

export function ownerOf(
  loaded: LoadedProduct,
  settle: () => Promise<void>,
  failures: Error[],
): FinishApplierOwner {
  return {
    loaded,
    settle,
    onFailure: (error) => {
      failures.push(error)
    },
  }
}

// The next macrotask turn: the applier's chain hands work over across
// macrotasks, never inside one.
export function nextTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

// Drains the chain: releases each settle by hand as it appears. It waits
// through a bounded number of turns per application, so a chain that stops
// making settles fails the test's assertions instead of hanging them.
export async function drain(fake: ReturnType<typeof fakeSettle>, applies: number): Promise<void> {
  let released = 0
  for (let turn = 0; turn < applies * 4 && released < applies; turn += 1) {
    await nextTurn()
    const parked = fake.settleCalls()
    if (parked > released) {
      fake.releaseAll()
      released = parked
    }
  }
  await nextTurn()
}
