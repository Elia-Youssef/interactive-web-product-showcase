import { Matrix4, Vector3, type Object3D } from 'three'
import type { Vec3 } from '@lib/camera/view'
import type { ProductHotspot } from './productRig'

// The rest position of every hotspot anchor, read once from the node
// transforms when the rig is parsed, in the loaded scene's own space: the
// space the model frame is measured in before the presentation centers the
// scene (PresentedProduct mounts the scene under a group offset by the
// frame center, and the camera plan subtracts that same center). The space
// is the scene root's, whatever the scene hangs under, and no pose enters
// it: the explode clip's first frame differs from the authored rest by the
// optimizer's key quantization, and the build-time validate step reads the
// rest straight from the document's node transforms.
export function anchorRestsOf(
  root: Object3D,
  hotspots: readonly ProductHotspot[],
): ReadonlyMap<string, Vec3> {
  const rests = new Map<string, Vec3>()
  for (const hotspot of hotspots) {
    rests.set(hotspot.id, restPositionIn(root, hotspot.node))
  }
  return rests
}

// The node's origin in the root's space, composed from the node transforms
// of the chain from the root down, in the order and with the arithmetic
// three's world matrix update uses for an unparented root, so the point
// equals the world position the document's node chain gives.
function restPositionIn(root: Object3D, node: Object3D): Vec3 {
  const chain: Object3D[] = []
  for (let current: Object3D | null = node; current !== root; current = current.parent) {
    if (current === null) {
      throw new Error(
        `internal error: the anchor '${node.name}' does not hang under the scene root`,
      )
    }
    chain.push(current)
  }
  root.updateMatrix()
  const matrix = new Matrix4().copy(root.matrix)
  for (const link of chain.reverse()) {
    link.updateMatrix()
    matrix.multiply(link.matrix)
  }
  const rest = new Vector3().setFromMatrixPosition(matrix)
  return [rest.x, rest.y, rest.z]
}
