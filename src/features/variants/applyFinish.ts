import type { Material } from 'three'
import type { ViewerFinish } from '@viewer/automation/viewerAutomation'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedMesh } from './mappedMeshes'
import { mappedSceneMeshes } from './mappedMeshes'
import { finishMaterialIndex, finishPrimitiveKey } from './variants.logic'

// One application of a finish to a loaded product: it swaps every mapped
// mesh's material to what the plan prescribes for the variant and settles
// the stage so the pipelines rebuild and the frame is recorded. The
// precompile has run at load, so an application sets materials and
// settles, nothing else. It is the only code that changes materials for
// finishes.

export type FinishApplication = {
  readonly loaded: LoadedProduct
  readonly variant: string
  // The stage's settle call: every material swap goes through it.
  readonly settle: () => Promise<void>
}

// Applies one finish and resolves with the automation record of what the
// scene graph carries afterwards. The record is read from the meshes
// themselves, never from the plan, so it is what the model really shows.
export async function applyFinish(application: FinishApplication): Promise<ViewerFinish> {
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
  return readFinishRecord(loaded, mapped, variant)
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

function resolvedMaterial(loaded: LoadedProduct, index: number): Material {
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

// The automation record of the applied finish: the material name every
// mapped mesh carries, read from the scene graph after the settle.
function readFinishRecord(
  loaded: LoadedProduct,
  mapped: readonly MappedMesh[],
  variant: string,
): ViewerFinish {
  const materials: Record<string, string> = {}
  for (const { mesh, entry } of mapped) {
    if (Array.isArray(mesh.material)) {
      throw new Error(
        `the mapped mesh '${mesh.name}' carries a material array after the application`,
      )
    }
    materials[finishPrimitiveKey(entry.mesh, entry.primitive)] = mesh.material.name
  }
  return { product: loaded.manifest.slug, applied: variant, materials }
}
