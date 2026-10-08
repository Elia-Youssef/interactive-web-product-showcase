import { asError } from '@lib/errors'
import { TaskChain } from '@lib/async/taskChain'
import { finishMaterialIndex, finishPrimitiveKey, prescribesMaterial } from '@lib/product'
import type { ViewerFinish } from '@viewer/automation/viewerAutomation'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedSceneNode } from '@viewer/product/mappedSceneNodes'
import { applyFinish, resolvedMaterial } from './applyFinish'
import { applyFirstFinish } from './firstFinishApplication'
import { mappedSceneMeshes } from './mappedMeshes'

// The finish applier of one loaded product. It serializes every application
// of the store's selection on one chain, carries the load-time precompile as
// its first step, and reads what is applied from the scene's meshes. One
// applier per load, created and disposed with it: a new load precompiles
// again, and an old applier never leaks into a new load.
//
// Each step applies the selection the applier holds when the step runs, not
// the one captured when it was queued, and no step is skipped on the
// strength of a stored record. A selection that moved while an application
// was in flight is therefore applied by a later step, and the scene always
// ends on the last selection handed in.

export type FinishApplierOwner = {
  readonly loaded: LoadedProduct
  // The stage's settle call: every application rides it.
  readonly settle: () => Promise<void>
  // Where a failed application lands: the product's typed failure.
  readonly onFailure: (error: Error) => void
}

export type FinishApplier = {
  // Moves the applier to a selection. The application itself is queued on
  // the chain; the step applies whatever selection the applier holds by the
  // time it runs.
  readonly apply: (variant: string) => void
  // The automation read: what the meshes carry now (the applied variant,
  // derived from the meshes, and the material name per mapped primitive),
  // plus the selection the applier is moving to. Read at access time, never
  // recorded beside the meshes.
  readonly readFinish: () => ViewerFinish
  // Stops the applier: steps that have not started apply nothing, and later
  // selections are ignored. It is disposed with the loaded product it
  // applies to.
  readonly dispose: () => void
  // Resolves once the first application, the precompile included, has
  // finished or failed, or once the applier is disposed before it could:
  // the presentation's ready settle waits for it. It never rejects; a
  // failed application reaches the owner's failure channel.
  readonly firstApplied: Promise<void>
}

export function createFinishApplier(owner: FinishApplierOwner): FinishApplier {
  const { loaded, settle } = owner
  const chain = new TaskChain()
  // The selection the applier is moving to, null until the first is handed.
  // The owner hands one in the same effect run that exposes the read, so a
  // read never sees the null.
  let requested: string | null = null
  // The precompile rides the first application, once per applier.
  let firstApplication = true
  let disposed = false
  const firstApplied = oneShotSignal()

  const step = async (): Promise<void> => {
    if (disposed || requested === null) {
      return
    }
    const variant = requested
    if (firstApplication) {
      firstApplication = false
      try {
        await applyFirstFinish({ loaded, variant, settle })
      } finally {
        firstApplied.mark()
      }
      return
    }
    await applyFinish({ loaded, variant, settle })
  }

  const apply = (variant: string): void => {
    if (disposed) {
      return
    }
    requested = variant
    void chain.push(step).catch((cause: unknown) => owner.onFailure(asError(cause)))
  }

  const readFinish = (): ViewerFinish => {
    if (requested === null) {
      throw new Error('the finish applier reads nothing before its first selection')
    }
    const mapped = mappedSceneMeshes(loaded)
    const materials = carriedMaterials(mapped)
    return {
      product: loaded.manifest.slug,
      applied: appliedVariantOf(loaded, mapped, materials),
      requested,
      materials,
    }
  }

  const dispose = (): void => {
    disposed = true
    firstApplied.mark()
  }

  return { apply, readFinish, dispose, firstApplied: firstApplied.settled }
}

// A signal that settles once: its promise resolves on the first mark, and
// a later mark changes nothing.
function oneShotSignal(): { readonly settled: Promise<void>; readonly mark: () => void } {
  let mark: () => void = () => undefined
  const settled = new Promise<void>((resolve) => {
    mark = resolve
  })
  return { settled, mark }
}

// The material name every mapped mesh primitive carries, read from the
// scene graph now and keyed by the file's own tables ('<mesh>:<primitive>'),
// the identity an e2e can derive from the shipped model, not by the names
// the loader renames.
function carriedMaterials(mapped: readonly MappedSceneNode[]): Record<string, string> {
  const materials: Record<string, string> = {}
  for (const { mesh, entry } of mapped) {
    if (Array.isArray(mesh.material)) {
      throw new Error(
        `the mapped mesh '${mesh.name}' carries a material array, the plan maps one material per primitive`,
      )
    }
    materials[finishPrimitiveKey(entry.mesh, entry.primitive)] = mesh.material.name
  }
  return materials
}

// The variant whose plan materials every mapped mesh carries, or null while
// the meshes match no single variant: mid-switch, or a mix no variant
// prescribes. Two variants that prescribe the same materials everywhere are
// indistinguishable on the meshes; the first in declaration order wins,
// which is the read's own word for that file's ambiguity.
function appliedVariantOf(
  loaded: LoadedProduct,
  mapped: readonly MappedSceneNode[],
  materials: Record<string, string>,
): string | null {
  variantLoop: for (const [variantIndex, variant] of loaded.finishes.plan.variants.entries()) {
    for (const { entry } of mapped) {
      // A variant the plan cannot dress every mapped mesh in is no
      // candidate: the apply path would refuse it the same way, so it can
      // never be what the meshes carry.
      if (!prescribesMaterial(entry, variantIndex)) {
        continue variantLoop
      }
      const expected = resolvedMaterial(
        loaded,
        entry,
        finishMaterialIndex(entry, variantIndex),
      ).name
      if (materials[finishPrimitiveKey(entry.mesh, entry.primitive)] !== expected) {
        continue variantLoop
      }
    }
    return variant
  }
  return null
}
