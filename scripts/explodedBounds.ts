// The parts' bounds at the explode clip's last key, read from the model
// bytes: every mesh node under a PART_ (itself or an ancestor), the SHADOW
// subtree excluded, posed by the channels' last key, its primitive boxes
// through the posed world matrices, unioned by the frame math the runtime
// plan runs. This is the build-time half of the home view's reach rule at
// the explode's end; the runtime half poses the loaded scene itself.

import type { Document, Node } from '@gltf-transform/core'
import { PART_PREFIX, SHADOW_NODE_NAME } from '../src/lib/product/contractNames.ts'
import { frameSpanOfMeshBoxes } from '../src/lib/camera/frame.ts'
import type { MeshBox, ModelBounds } from '../src/lib/camera/frame.ts'
import type { ChannelFact } from './animationFacts.ts'
import { primitiveBox } from './modelFacts.ts'
import { posedWorldMatricesOf } from './nodePoses.ts'

export function explodedBoundsOf(
  doc: Document,
  channels: readonly ChannelFact[],
): ModelBounds | null {
  const worlds = posedWorldMatricesOf(doc, channels)
  const boxes: MeshBox[] = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null || !isPartOwned(node) || inShadowSubtree(node)) {
      continue
    }
    const matrix = worlds.get(node)
    if (matrix === undefined) {
      continue
    }
    for (const primitive of mesh.listPrimitives()) {
      const box = primitiveBox(primitive)
      if (box !== null) {
        boxes.push({ min: box.min, max: box.max, matrix })
      }
    }
  }
  if (boxes.length === 0) {
    return null
  }
  const span = frameSpanOfMeshBoxes(boxes)
  return { min: span.min, max: span.max }
}

// Whether the node itself or an ancestor carries a PART_ name: the subtree
// the exploded view moves and the runtime's exploded bounds traverse.
function isPartOwned(node: Node): boolean {
  return hasAncestorName(node, (name) => name.startsWith(PART_PREFIX))
}

function inShadowSubtree(node: Node): boolean {
  return hasAncestorName(node, (name) => name === SHADOW_NODE_NAME)
}

function hasAncestorName(node: Node, matches: (name: string) => boolean): boolean {
  for (let current: Node | null = node; current !== null; current = current.getParentNode()) {
    if (matches(current.getName())) {
      return true
    }
  }
  return false
}
