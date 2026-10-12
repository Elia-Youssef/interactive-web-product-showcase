import type { CameraRead } from './stageCamera'
import type { ProductHotspotFacts } from './productHotspots'

// The projection the hotspot spec checks markers against, restated here from
// the camera read and the stage box instead of imported from the viewer, so
// a viewer regression cannot hide behind its own math. The conventions are
// the stage camera's: the camera looks from position at target with up +Y
// (the orbit never reaches a pole, so the up never flips), fovY is the
// vertical field of view, and the projection lands in CSS pixels from the
// stage box's top-left with y running down.

export type StagePoint = { readonly x: number; readonly y: number }

export type Point3 = { readonly x: number; readonly y: number; readonly z: number }

// The camera reads the projection needs: where the camera stands, where it
// looks and its vertical fov. A live camera read carries them, and so does
// an authored view's ray.
export type ProjectionCamera = Pick<CameraRead, 'position' | 'target' | 'fovY'>

export function projectToStageBox(
  camera: ProjectionCamera,
  anchor: Point3,
  box: { readonly width: number; readonly height: number },
): StagePoint {
  const v = viewOf(camera.position, camera.target)(anchor)
  // The standard perspective projection: a point in front of the camera has
  // negative view z, so the clip w is -z, positive in front.
  const f = 1 / Math.tan(camera.fovY / 2)
  const aspect = box.width / box.height
  const ndcX = (f / aspect) * (v.x / -v.z)
  const ndcY = f * (v.y / -v.z)
  return {
    x: ((ndcX + 1) / 2) * box.width,
    y: ((1 - ndcY) / 2) * box.height,
  }
}

// How far in front of the camera a point stands along its view axis: the
// negated view z, positive in front, so a projection is meaningful exactly
// when it is above zero.
export function viewDepthOf(camera: ProjectionCamera, point: Point3): number {
  return -viewOf(camera.position, camera.target)(point).z
}

// The view transform of a look-at with up +Y: the world point through the
// camera's basis rows, minus the camera position.
function viewOf(
  eye: Point3,
  target: Point3,
): (point: Point3) => { x: number; y: number; z: number } {
  const z = normalize(sub(eye, target))
  const x = normalize(cross([0, 1, 0], z))
  const y = cross(z, x)
  const tx = x[0] * eye.x + x[1] * eye.y + x[2] * eye.z
  const ty = y[0] * eye.x + y[1] * eye.y + y[2] * eye.z
  const tz = z[0] * eye.x + z[1] * eye.y + z[2] * eye.z
  return (p) => ({
    x: x[0] * p.x + x[1] * p.y + x[2] * p.z - tx,
    y: y[0] * p.x + y[1] * p.y + y[2] * p.z - ty,
    z: z[0] * p.x + z[1] * p.y + z[2] * p.z - tz,
  })
}

function sub(a: Point3, b: Point3): [number, number, number] {
  return [a.x - b.x, a.y - b.y, a.z - b.z]
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(a: [number, number, number]): [number, number, number] {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

// The distance at which the segment from to `to` enters the axis-aligned
// box, or null when the segment misses the box or starts inside it. The
// occlusion argument reads it: an anchor inside the box, a camera outside,
// and an entry strictly between them is the body standing in front of the
// anchor.
export function segmentEntersBox(
  from: Point3,
  to: Point3,
  bounds: { readonly min: Point3; readonly max: Point3 },
): Point3 | null {
  let tMin = 0
  let tMax = 1
  for (const axis of ['x', 'y', 'z'] as const) {
    const start = from[axis]
    const end = to[axis]
    const low = bounds.min[axis]
    const high = bounds.max[axis]
    const span = end - start
    if (Math.abs(span) < 1e-12) {
      if (start < low || start > high) {
        return null
      }
      continue
    }
    let tEnter = (low - start) / span
    let tExit = (high - start) / span
    if (tEnter > tExit) {
      ;[tEnter, tExit] = [tExit, tEnter]
    }
    tMin = Math.max(tMin, tEnter)
    tMax = Math.min(tMax, tExit)
    if (tMin > tMax) {
      return null
    }
  }
  if (tMin <= 0 || tMin >= 1) {
    return null
  }
  return {
    x: from.x + (to.x - from.x) * tMin,
    y: from.y + (to.y - from.y) * tMin,
    z: from.z + (to.z - from.z) * tMin,
  }
}

// Whether the point lies inside the closed box, edges included.
export function isInsideBox(
  point: Point3,
  bounds: { readonly min: Point3; readonly max: Point3 },
): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  )
}

// The point a model fact's position tuple carries, as one shape for the
// geometry helpers. A short tuple is a broken fact, not an empty corner.
export function pointOf(tuple: readonly [number, number, number]): Point3 {
  const [x, y, z] = tuple
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error('a model fact arrived with a short position')
  }
  return { x, y, z }
}

// The facts' occluder bounds as points, so the geometry helpers read one
// shape.
export function factsBoundsOf(facts: ProductHotspotFacts): {
  readonly min: Point3
  readonly max: Point3
} {
  return { min: pointOf(facts.occluderBounds.min), max: pointOf(facts.occluderBounds.max) }
}
