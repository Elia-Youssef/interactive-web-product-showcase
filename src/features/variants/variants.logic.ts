import type { FinishPlan, FinishPrimitivePlan } from '@lib/product'

// The pure finish math the controller runs per application: which plan
// entries are mapped, and which material index an entry carries for one
// variant. No React, no three.js: the scene walk that uses this lives in
// the controller.

// The key a mapped mesh primitive is reported under in the automation's
// finish record: the glTF mesh and primitive indexes, the identity the
// file's own tables carry and nothing the loader renamed.
export function finishPrimitiveKey(mesh: number, primitive: number): string {
  return `${mesh}:${primitive}`
}

// The mapped entries of a plan: the primitives the variants extension
// actually maps. These are the only meshes a finish switch touches; a
// primitive without a mapping keeps its default under every variant.
export function mappedFinishEntries(plan: FinishPlan): readonly FinishPrimitivePlan[] {
  return plan.primitives.filter((entry) => entry.variantMaterials.size > 0)
}

// The material index a mapped entry carries for one variant: the mapping's
// material, or the primitive default when the mapping omits the variant. A
// mapped entry with no default material was validated to be covered by a
// full mapping, so a hole here is a plan the file did not declare, and it
// fails instead of guessing.
export function finishMaterialIndex(entry: FinishPrimitivePlan, variantIndex: number): number {
  const mapped = entry.variantMaterials.get(variantIndex)
  if (mapped !== undefined) {
    return mapped
  }
  if (entry.defaultMaterial === null) {
    throw new Error(
      `mesh ${entry.mesh} primitive ${entry.primitive} carries no material for the variant ${variantIndex}`,
    )
  }
  return entry.defaultMaterial
}

// The geometry and material pairs a load's precompile must cover: every
// mapped mesh, with every material its entry could dress it in, default
// and mapped alike. A pipeline is keyed by the geometry's attributes as
// well as the material, so a material compiled on one mesh's geometry is
// not the pipeline another mesh's switch uses; the pairs say so exactly.
export function precompilePairs(
  plan: FinishPlan,
): readonly { readonly mesh: number; readonly materialIndex: number }[] {
  const pairs: { mesh: number; materialIndex: number }[] = []
  for (const entry of mappedFinishEntries(plan)) {
    const seen = new Set<number>()
    if (entry.defaultMaterial !== null) {
      seen.add(entry.defaultMaterial)
    }
    for (const materialIndex of entry.variantMaterials.values()) {
      seen.add(materialIndex)
    }
    for (const materialIndex of seen) {
      pairs.push({ mesh: entry.mesh, materialIndex })
    }
  }
  return pairs
}
