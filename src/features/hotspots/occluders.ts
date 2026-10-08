import { Mesh } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import type { LoadedProduct } from '@viewer/product/loadedProduct'

// The occluders of a loaded product: every mesh of its scene except the
// rig's shadow subtree, which is a flat picture on the floor and never
// stands between the camera and an anchor. Finishes swap materials, never
// geometry, so the set is collected once per load; each ray reads the
// meshes' current world matrices at raycast time.
export function collectOccluders(loaded: LoadedProduct): Mesh[] {
  const occluders: Mesh[] = []
  const walk = (node: Object3D): void => {
    if (node === loaded.rig.shadow) {
      return
    }
    if (node instanceof Mesh) {
      occluders.push(node)
    }
    for (const child of node.children) {
      walk(child)
    }
  }
  walk(loaded.scene)
  return occluders
}
