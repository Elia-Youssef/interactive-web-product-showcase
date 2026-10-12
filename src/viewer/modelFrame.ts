import { Line, Mesh, Points } from 'three/webgpu'
import type { BufferGeometry, Object3D } from 'three/webgpu'
import { frameSpanOfMeshBoxes, isMat4 } from '@lib/camera/frame'
import type { MeshBox, Vec3 } from '@lib/camera/frame'

// What it takes to frame a loaded model: its bounding box, the center of
// that box, the radius of the bounding sphere around it, and the shape
// counts the store's ready status carries. Measured once, on load, in the
// model's own space.

export type ModelFrame = {
  // The center of the bounding box, in the model's own space.
  readonly centerX: number
  readonly centerY: number
  readonly centerZ: number
  // The radius of the bounding sphere around that center.
  readonly radius: number
  readonly meshes: number
  readonly triangles: number
  // The corners of the bounding box, in the model's own space.
  readonly min: Vec3
  readonly max: Vec3
}

// Measures a loaded model subtree. One box per geometry-carrying object
// feeds the shared frame math, the same function the build-time validate
// step feeds from gltf-transform, so both sides measure one frame. The
// objects selected are the ones three's own Box3.setFromObject selects
// (everything that carries geometry: meshes, points and lines, skinned and
// instanced meshes included through Mesh), and the world matrices are
// refreshed for the whole subtree top-down the way Box3.setFromObject
// refreshes them, so a tree that has not rendered yet measures the same as
// one that has, wrapper nodes included. Every allocation here happens once
// per load; nothing of it is kept alive.
export function measureModelFrame(root: Object3D): ModelFrame {
  root.updateWorldMatrix(false, true)
  const meshBoxes: MeshBox[] = []
  let meshes = 0
  let triangles = 0
  root.traverse((node) => {
    if (!carriesGeometry(node)) {
      return
    }
    meshBoxes.push(worldBoxOf(node))
    meshes += 1
    if (node instanceof Mesh) {
      triangles += meshTriangleCount(node)
    }
  })

  if (meshes === 0) {
    throw new Error(`the model subtree '${root.name || 'unnamed'}' holds no meshes to frame`)
  }

  const span = frameSpanOfMeshBoxes(meshBoxes)
  return {
    centerX: span.center[0],
    centerY: span.center[1],
    centerZ: span.center[2],
    radius: span.radius,
    meshes,
    triangles,
    min: span.min,
    max: span.max,
  }
}

// The objects three's Box3.setFromObject contributes: every object that
// carries a geometry. The loader builds meshes, points and lines; skinned
// and instanced meshes are Mesh subclasses. For every one of these classes
// the model contract admits, the object carries no bounding box of its own,
// so Box3 reads the geometry's box, and so does the feed below.
export function carriesGeometry(node: Object3D): node is Mesh | Points | Line {
  return node instanceof Mesh || node instanceof Points || node instanceof Line
}

// The object's box in world space, as three's own non-precise bounds read
// it: the geometry's bounding box over its position attribute, transformed
// by the object's world matrix.
export function worldBoxOf(object: Mesh | Points | Line): MeshBox {
  const box = boxOf(object.geometry)
  const elements = object.matrixWorld.elements
  if (!isMat4(elements)) {
    throw new Error('internal error: a world matrix carries fewer than 16 elements')
  }
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    matrix: elements,
  }
}

function boxOf(geometry: BufferGeometry) {
  const cached = geometry.boundingBox
  if (cached !== null) {
    return cached
  }
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (box === null) {
    throw new Error('internal error: computeBoundingBox left no bounding box')
  }
  return box
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
