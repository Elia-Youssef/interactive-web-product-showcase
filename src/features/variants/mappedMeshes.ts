import { finishPrimitiveKey, mappedFinishEntries } from '@lib/product'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import { mappedSceneNodes, type MappedSceneNode } from '@viewer/product/mappedSceneNodes'

// Every scene mesh a plan entry maps. A mapped primitive with no mesh in
// the scene is a file that maps something it never shows, and fails instead
// of switching silently less than the file declared.
export function mappedSceneMeshes(loaded: LoadedProduct): readonly MappedSceneNode[] {
  const entries = mappedFinishEntries(loaded.finishes.plan)
  const mapped: MappedSceneNode[] = []
  const missing = new Set(entries.map((entry) => finishPrimitiveKey(entry.mesh, entry.primitive)))
  for (const node of mappedSceneNodes(loaded.scene, loaded.parser.associations, entries)) {
    missing.delete(finishPrimitiveKey(node.entry.mesh, node.entry.primitive))
    mapped.push(node)
  }
  if (missing.size > 0) {
    throw new Error(
      `the loaded product's scene holds no mesh for the mapped primitives ${[...missing].sort().join(', ')}`,
    )
  }
  return mapped
}
