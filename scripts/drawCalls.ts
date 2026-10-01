// The draw-call count of a model, against DRAW_CALLS_MAX. The definition is
// the budget's: one draw call is one mesh primitive instance in the scene,
// a mesh primitive rendered by one node. A mesh with three primitives on
// one node costs three; the same mesh on a second node costs three more,
// because the renderer draws each instance.
import type { Document, Node } from '@gltf-transform/core'

export function countDrawCalls(doc: Document): number {
  let count = 0
  const visit = (node: Node): void => {
    const mesh = node.getMesh()
    if (mesh !== null) {
      count += mesh.listPrimitives().length
    }
    for (const child of node.listChildren()) {
      visit(child)
    }
  }
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      visit(node)
    }
  }
  return count
}
