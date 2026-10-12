import { Mesh } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import { finishPrimitiveKey, type FinishPrimitivePlan } from '@lib/product'

// What the glTF loader recorded about one object it built: the index of the
// glTF mesh, primitive or material the object came from. The loader records
// the primitive index at runtime for every mesh primitive it builds. The
// type is declared here, with the one walk that reads it, so the modules
// that read the loader's parser view import it from a module that imports
// nothing back.
export type GltfAssociation = {
  readonly meshes?: number
  readonly primitives?: number
  readonly materials?: number
}

// The scene walk the finish work shares: which mesh node of a parsed scene
// does a plan entry dress. The load-time derivation and the runtime
// applications both pair nodes and entries through this one walk, so they
// can never disagree about which meshes a finish touches.

// One scene mesh node a finish plan maps, with the plan entry it maps to.
export type MappedSceneNode = {
  readonly mesh: Mesh
  readonly entry: FinishPrimitivePlan
}

// Pairs every mesh node of the scene whose loader association names a
// planned mesh and primitive with that plan entry. A node without a (mesh,
// primitive) association carries no mapped primitive, and an association no
// entry names is not mapped. That an entry matched no node at all is left
// to the caller to judge: the load derives whatever the scene carries,
// while an application refuses a plan the scene cannot dress.
export function mappedSceneNodes(
  scene: Object3D,
  associations: ReadonlyMap<object, GltfAssociation>,
  entries: readonly FinishPrimitivePlan[],
): readonly MappedSceneNode[] {
  const entriesByKey = new Map<string, FinishPrimitivePlan>()
  for (const entry of entries) {
    entriesByKey.set(finishPrimitiveKey(entry.mesh, entry.primitive), entry)
  }
  const nodes: MappedSceneNode[] = []
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return
    }
    const association = associations.get(node)
    if (association?.meshes === undefined || association.primitives === undefined) {
      return
    }
    const entry = entriesByKey.get(finishPrimitiveKey(association.meshes, association.primitives))
    if (entry === undefined) {
      return
    }
    nodes.push({ mesh: node, entry })
  })
  return nodes
}
