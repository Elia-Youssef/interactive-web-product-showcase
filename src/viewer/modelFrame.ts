import { Box3, Mesh, Sphere } from 'three'
import type { Object3D } from 'three'

// What it takes to frame a loaded model: the center of its bounding box, the
// radius of the bounding sphere around it, and the shape counts the
// automation hook reports. Measured once, on load, in the model's own space.

export type ModelFrame = {
  // The center of the bounding box, in the model's own space.
  readonly centerX: number
  readonly centerY: number
  readonly centerZ: number
  // The radius of the bounding sphere around that center.
  readonly radius: number
  readonly meshes: number
  readonly triangles: number
}

// Measures a loaded model subtree. Every allocation here happens once per
// load; nothing of it is kept alive.
export function measureModelFrame(root: Object3D): ModelFrame {
  const sphere = new Sphere()
  new Box3().setFromObject(root).getBoundingSphere(sphere)

  let meshes = 0
  let triangles = 0
  root.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return
    }
    meshes += 1
    triangles += meshTriangleCount(node)
  })

  if (meshes === 0) {
    throw new Error(`the model subtree '${root.name || 'unnamed'}' holds no meshes to frame`)
  }

  return {
    centerX: sphere.center.x,
    centerY: sphere.center.y,
    centerZ: sphere.center.z,
    radius: sphere.radius,
    meshes,
    triangles,
  }
}

// A glTF primitive is one three mesh: indexed geometries carry one triangle
// per three indices, non-indexed ones per three vertices.
function meshTriangleCount(mesh: Mesh): number {
  const geometry = mesh.geometry
  if (geometry.index !== null) {
    return Math.floor(geometry.index.count / 3)
  }
  const position = geometry.getAttribute('position')
  if (position === undefined) {
    throw new Error(`the mesh '${mesh.name || 'unnamed'}' has neither indices nor positions`)
  }
  return Math.floor(position.count / 3)
}
