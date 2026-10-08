import type { Material } from 'three/webgpu'
import { finishDerivedKey, finishMaterialIndex, type FinishPrimitivePlan } from '@lib/product'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedSceneNode } from '@viewer/product/mappedSceneNodes'
import { mappedSceneMeshes } from './mappedMeshes'

// One application of a finish to a loaded product: it swaps every mapped
// mesh's material to what the plan prescribes for the variant and settles
// the stage so the pipelines rebuild and the frame is recorded. The
// precompile has run with the first application, so an application here sets
// materials and settles, nothing else. The applier is its only caller, and
// what the application landed on is read from the meshes by the applier's
// own read, never recorded beside them.

export type FinishApplication = {
  readonly loaded: LoadedProduct
  readonly variant: string
  // The stage's settle call: every material swap goes through it.
  readonly settle: () => Promise<void>
}

// Applies one finish. It resolves when the settle has presented the swap.
export async function applyFinish(application: FinishApplication): Promise<void> {
  const { loaded, variant, settle } = application
  const variantIndex = loaded.finishes.plan.variants.indexOf(variant)
  if (variantIndex === -1) {
    throw new Error(
      `the offered finish '${variant}' is not a variant of the loaded product '${loaded.manifest.slug}'`,
    )
  }
  const mapped = mappedSceneMeshes(loaded)
  applyVariantMaterials(loaded, mapped, variantIndex)
  await settle()
}

function applyVariantMaterials(
  loaded: LoadedProduct,
  mapped: readonly MappedSceneNode[],
  variantIndex: number,
): void {
  for (const { mesh, entry } of mapped) {
    const material = resolvedMaterial(loaded, entry, finishMaterialIndex(entry, variantIndex))
    assertSingleMaterial(mesh)
    mesh.material = material
  }
}

// The derived material one plan entry shows for one material index: the
// load's table is the one answer every reader resolves through, so an
// application and the applier's read can never disagree about what a
// variant dresses a mesh in, and no raw material reaches a mesh.
export function resolvedMaterial(
  loaded: LoadedProduct,
  entry: FinishPrimitivePlan,
  index: number,
): Material {
  const material = loaded.finishes.materials.get(
    finishDerivedKey(entry.mesh, entry.primitive, index),
  )
  if (material === undefined) {
    throw new Error(
      `the loaded product '${loaded.manifest.slug}' derived no material for the mesh ${entry.mesh} primitive ${entry.primitive} at the index ${index}`,
    )
  }
  return material
}

function assertSingleMaterial(mesh: MappedSceneNode['mesh']): void {
  if (Array.isArray(mesh.material)) {
    throw new Error(
      `the mapped mesh '${mesh.name}' carries a material array, the plan maps one material per primitive`,
    )
  }
}
