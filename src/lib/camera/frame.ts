// The model frame as pure math: the bounds, center and radius a loaded
// model is framed by, computed from one box per mesh. The computation is exactly
// three's non-precise Box3.setFromObject semantics (the geometry bounding
// box's eight corners transformed by the mesh's world matrix, the union of
// the transformed boxes, the circumscribed sphere of the union), so the
// runtime, which feeds it from three, and the build-time validate step,
// which feeds it from gltf-transform, measure the same frame the same way.
// Vectors are readonly tuples; column-major matrices; exact values, no
// rounding. The module carries no runtime imports, so the validate step's
// plain Node run can execute it straight from its .ts file.

import type { Vec3 } from './view'

export type { Vec3 }

// A column-major 4x4 matrix: the element order of three's Matrix4 and of a
// glTF node's world matrix.
export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

// The matrix kind: exactly 16 elements. The world matrices three keeps and
// glTFTransform composes always carry 16, so a shorter array is a caller
// contract break, named here rather than indexed as undefined.
export function isMat4(elements: readonly number[]): elements is Mat4 {
  return elements.length === 16
}

// One mesh's local axis-aligned bounds and the world matrix they sit in.
// The bounds are the position extremes in the model's own units, as three's
// geometry bounding box holds them and as a glTF POSITION accessor's
// normalized bounds name them.
export type MeshBox = {
  readonly min: Vec3
  readonly max: Vec3
  readonly matrix: Mat4
}

// The axis-aligned bounding box of a model: its smallest and its largest
// corner.
export type ModelBounds = {
  readonly min: Vec3
  readonly max: Vec3
}

// The frame of a model: its bounding box, the center of that box, and the
// radius of the circumscribed sphere around the center.
export type FrameSpan = ModelBounds & {
  readonly center: Vec3
  readonly radius: number
}

// The frame of the model the boxes belong to. Every box contributes its
// eight transformed corners; the union of the transformed boxes is the
// model's world-space bounds, and the sphere is the box's own: the center
// of the box, the half diagonal as the radius. An empty box contributes
// nothing, the way three's Box3.union skips it, so a geometry with no
// positions cannot turn the frame into NaN; a frame of nothing throws.
export function frameSpanOfMeshBoxes(meshBoxes: readonly MeshBox[]): FrameSpan {
  if (meshBoxes.length === 0) {
    throw new Error('a frame needs at least one mesh box')
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const box of meshBoxes) {
    if (isEmpty(box)) {
      continue
    }
    for (const [x, y, z] of transformedCorners(box)) {
      min[0] = Math.min(min[0], x)
      min[1] = Math.min(min[1], y)
      min[2] = Math.min(min[2], z)
      max[0] = Math.max(max[0], x)
      max[1] = Math.max(max[1], y)
      max[2] = Math.max(max[2], z)
    }
  }
  if (min[0] === Infinity) {
    throw new Error('a frame needs at least one mesh box that bounds something')
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  return {
    center,
    radius: Math.sqrt(size[0] * size[0] + size[1] * size[1] + size[2] * size[2]) * 0.5,
    min,
    max,
  }
}

// Empty the way Box3.isEmpty reads it: any side inverted. A flat box (a
// side collapsed to zero) bounds a plane and is not empty.
function isEmpty(box: MeshBox): boolean {
  return box.max[0] < box.min[0] || box.max[1] < box.min[1] || box.max[2] < box.min[2]
}

// The eight corners of the box, transformed by its matrix. The transform is
// the affine point transform three's Vector3.applyMatrix4 applies to the
// corners (the world matrices of glTF nodes are affine, so the perspective
// divide reads 1 and is exact).
function transformedCorners(box: MeshBox): readonly Vec3[] {
  const corners: Vec3[] = []
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        corners.push(transformPointOf(box.matrix, [x, y, z]))
      }
    }
  }
  return corners
}

// The affine point transform of the matrix: the same three applies to the
// box corners, and the same transform a glTF camera node's world matrix
// applies to its origin. Shared, so the frame math and every fact read from
// a document transform points the same way.
export function transformPointOf(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [
    x * m[0] + y * m[4] + z * m[8] + m[12],
    x * m[1] + y * m[5] + z * m[9] + m[13],
    x * m[2] + y * m[6] + z * m[10] + m[14],
  ]
}

// The model's reach from a point: the largest distance from the point to
// any point of the bounding box, which one of the box's eight corners
// attains, per axis the side farther from the point.
export function farthestPointFrom(bounds: ModelBounds, point: Vec3): number {
  const dx = Math.max(Math.abs(point[0] - bounds.min[0]), Math.abs(point[0] - bounds.max[0]))
  const dy = Math.max(Math.abs(point[1] - bounds.min[1]), Math.abs(point[1] - bounds.max[1]))
  const dz = Math.max(Math.abs(point[2] - bounds.min[2]), Math.abs(point[2] - bounds.max[2]))
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// A point of the model's own space in stage space. The presentation centers
// the model on the origin, so every point moves by the frame center. The
// runtime plan, the build-time validate step and the specs' camera facts
// move their points into stage space through this one function, so the
// contract assembly reads the same numbers on every side, rounding
// included.
export function inStageSpace(point: Vec3, center: Vec3): Vec3 {
  return [point[0] - center[0], point[1] - center[1], point[2] - center[2]]
}

// The model's bounds in stage space, moved by the frame center like every
// other point.
export function boundsInStageSpace(bounds: ModelBounds, center: Vec3): ModelBounds {
  return { min: inStageSpace(bounds.min, center), max: inStageSpace(bounds.max, center) }
}
