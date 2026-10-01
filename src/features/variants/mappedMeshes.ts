import { Mesh } from 'three'
import type { FinishPrimitivePlan } from '@lib/product'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import { finishPrimitiveKey, mappedFinishEntries } from './variants.logic'

// A scene mesh the plan maps, with the plan entry it maps to. The apply and
// the precompile both walk the scene through the loader's own associations,
// so they always agree on which meshes a finish touches.

export type MappedMesh = {
  readonly mesh: Mesh
  readonly entry: FinishPrimitivePlan
}

// Every scene mesh a plan entry maps. A mapped primitive with no mesh in
// the scene is a file that maps something it never shows, and fails instead
// of switching silently less than the file declared.
export function mappedSceneMeshes(loaded: LoadedProduct): MappedMesh[] {
  const entriesByAssociation = new Map<string, FinishPrimitivePlan>()
  for (const entry of mappedFinishEntries(loaded.finishes.plan)) {
    entriesByAssociation.set(finishPrimitiveKey(entry.mesh, entry.primitive), entry)
  }
  const mapped: MappedMesh[] = []
  const missing = new Set(entriesByAssociation.keys())
  loaded.scene.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return
    }
    const association = loaded.parser.associations.get(node)
    if (association?.meshes === undefined || association.primitives === undefined) {
      return
    }
    const key = finishPrimitiveKey(association.meshes, association.primitives)
    const entry = entriesByAssociation.get(key)
    if (entry === undefined) {
      return
    }
    missing.delete(key)
    mapped.push({ mesh: node, entry })
  })
  if (missing.size > 0) {
    throw new Error(
      `the loaded product's scene holds no mesh for the mapped primitives ${[...missing].sort().join(', ')}`,
    )
  }
  return mapped
}
