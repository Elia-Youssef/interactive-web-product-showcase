import type { FinishPlan, FinishPrimitivePlan } from './variants'
import { finishEntryMaterialIndexes } from './variants'

// The finish plan queries every consumer of a loaded finish plan shares:
// the loader's resolver derives the mapped primitives' materials from these
// tables at load, and the variants controller switches and reads them at
// runtime. Pure math over the plan: no React, no three.js; the scene walk
// that uses it lives one layer up.

// The key a mapped mesh primitive is reported under in the automation's
// finish record: the glTF mesh and primitive indexes, the identity the
// file's own tables carry and nothing the loader renamed.
export function finishPrimitiveKey(mesh: number, primitive: number): string {
  return `${mesh}:${primitive}`
}

// The key one derived material sits under in a load's finish table: the
// mapped primitive and the material index, the pair the derivation ran
// for. One material index can derive to one material per primitive, since
// the loader reads each mesh's geometry for its clone flags.
export function finishDerivedKey(mesh: number, primitive: number, materialIndex: number): string {
  return `${finishPrimitiveKey(mesh, primitive)}:${materialIndex}`
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

// Whether one mapped entry is dressed under a variant at all: the mapping
// names it, or the primitive default stands in. An entry the plan cannot
// dress is no candidate for what the meshes carry: the apply path refuses
// it the same way.
export function prescribesMaterial(entry: FinishPrimitivePlan, variantIndex: number): boolean {
  return entry.variantMaterials.has(variantIndex) || entry.defaultMaterial !== null
}

// The geometry and material pairs a load's precompile must cover: every
// mapped mesh, with every material its entry could dress it in, default
// and mapped alike. A pipeline is keyed by the geometry's attributes as
// well as the material, so a material compiled on one mesh's geometry is
// not the pipeline another mesh's switch uses; the pairs say so exactly.
export function precompilePairs(plan: FinishPlan): readonly {
  readonly mesh: number
  readonly primitive: number
  readonly materialIndex: number
}[] {
  const pairs: { mesh: number; primitive: number; materialIndex: number }[] = []
  for (const entry of mappedFinishEntries(plan)) {
    for (const materialIndex of finishEntryMaterialIndexes(entry)) {
      pairs.push({ mesh: entry.mesh, primitive: entry.primitive, materialIndex })
    }
  }
  return pairs
}
