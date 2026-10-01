import type { Material } from 'three'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedMesh } from './mappedMeshes'
import { mappedSceneMeshes } from './mappedMeshes'
import { finishMaterialIndex } from './variants.logic'

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
  mapped: readonly MappedMesh[],
  variantIndex: number,
): void {
  for (const { mesh, entry } of mapped) {
    const material = resolvedMaterial(loaded, finishMaterialIndex(entry, variantIndex))
    assertSingleMaterial(mesh)
    mesh.material = material
  }
}

// The material behind one plan index: the table every application and the
// applier's read resolve through.
export function resolvedMaterial(loaded: LoadedProduct, index: number): Material {
  const material = loaded.finishes.materials.get(index)
  if (material === undefined) {
    throw new Error(
      `the loaded product '${loaded.manifest.slug}' resolved no material for the index ${index}`,
    )
  }
  return material
}

function assertSingleMaterial(mesh: MappedMesh['mesh']): void {
  if (Array.isArray(mesh.material)) {
    throw new Error(
      `the mapped mesh '${mesh.name}' carries a material array, the plan maps one material per primitive`,
    )
  }
}
