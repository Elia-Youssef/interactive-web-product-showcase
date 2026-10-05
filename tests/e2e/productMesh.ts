import { Box3, Group, Mesh, Vector3, type Object3D } from 'three'
import type { vec3 } from '@gltf-transform/core'
import { AnchorOcclusion } from '../../src/viewer/occlusion/AnchorOcclusion'
import { SHADOW_NODE_NAME } from '../../src/lib/product/contractNames'

export type OccluderMeshes = {
  readonly meshes: Mesh[]
  readonly min: vec3
  readonly max: vec3
}

// Keep the loader's geometry, materials and transforms intact. A parent
// group supplies the same stage-space centering as the presented product.
export function readOccluderMeshes(scene: Object3D, center: vec3): OccluderMeshes {
  const group = new Group()
  group.position.set(-center[0], -center[1], -center[2])
  group.add(scene)
  group.updateMatrixWorld(true)
  const meshes = occluderMeshesOf(scene)
  const bounds = boundsOf(meshes)
  return { meshes, min: bounds.min.toArray(), max: bounds.max.toArray() }
}

// Bounds include the selected meshes' referenced vertices only, never a
// subtree (which could contain an excluded shadow mesh).
function boundsOf(meshes: Mesh[]): Box3 {
  const bounds = new Box3()
  const vertex = new Vector3()
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position')
    if (position === undefined) {
      throw new Error(`the mesh '${mesh.name}' carries no positions`)
    }
    const index = mesh.geometry.index
    const count = index === null ? position.count : index.count
    for (let at = 0; at < count; at += 1) {
      mesh.getVertexPosition(index === null ? at : index.getX(at), vertex)
      bounds.expandByPoint(vertex.applyMatrix4(mesh.matrixWorld))
    }
  }
  return bounds
}

// The runtime excludes the shadow subtree from the product's occluders.
export function occluderMeshesOf(scene: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  scene.traverse((node) => {
    if (node instanceof Mesh && !isUnderShadow(node)) {
      meshes.push(node)
    }
  })
  return meshes
}

function isUnderShadow(node: Object3D): boolean {
  for (let current: Object3D | null = node; current !== null; current = current.parent) {
    if (current.name === SHADOW_NODE_NAME) {
      return true
    }
  }
  return false
}

// The viewer owns the segment test; facts only adapt tuple coordinates.
export function isBlocked(origin: vec3, anchor: vec3, meshes: Mesh[]): boolean {
  return new AnchorOcclusion().isBlocked(new Vector3(...origin), new Vector3(...anchor), meshes)
}
