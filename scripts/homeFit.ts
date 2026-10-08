// The home fit (contract C5) as pure math: how much of the half frame a
// pose keeps free around the product, seen through the authored home
// camera, and how large a storage allowance the file's own precision can
// spend before a pose that reads below the margin is still held. The
// projection is the one the viewer rebuilds for a presented view: the
// camera's stored ray and vertical fov, the authored aspect, vertical fit,
// a roll-free basis over world up. Every function is exact: no tolerance
// sits anywhere in the comparison.

import type { Vec3 } from '../src/lib/camera/frame.ts'

// The world up of glTF space, the up the controls rebuild every view from.
const WORLD_UP: Vec3 = [0, 1, 0]

// The normalized device bounds (-1..1) of points seen from a roll-free
// camera: per axis, the smallest and largest reach, and the smallest share
// of the half frame any one side keeps free (negative when a point falls
// outside the frame), with the index of the binding point, the one that
// attains it.
export function frameExtentOf(
  points: readonly Vec3[],
  cameraPosition: Vec3,
  forward: Vec3,
  fovYRadians: number,
  aspect: number,
): {
  readonly x: [number, number]
  readonly y: [number, number]
  readonly free: number
  readonly bindingPoint: number
} {
  const f = unitOf(forward)
  const r = rightOf(f)
  const u = crossOf(r, f)
  const t = Math.tan(fovYRadians / 2)
  const xs: number[] = []
  const ys: number[] = []
  let reach = -Infinity
  let bindingPoint = 0
  for (const [index, point] of points.entries()) {
    const q = subOf(point, cameraPosition)
    const depth = dotOf(q, f)
    if (depth <= 0) {
      throw new Error('a point lies behind the camera plane')
    }
    const x = dotOf(q, r) / (depth * t * aspect)
    const y = dotOf(q, u) / (depth * t)
    xs.push(x)
    ys.push(y)
    const abs = Math.max(Math.abs(x), Math.abs(y))
    if (abs > reach) {
      reach = abs
      bindingPoint = index
    }
  }
  return {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
    free: 1 - reach,
    bindingPoint,
  }
}

// The nearest a pose's bounding-box corner comes to the camera plane along
// the view direction: the box's eight corners over the pose's points, each
// projected onto the camera's forward axis, the smallest depth taken.
export function nearestCornerDepthOf(
  points: readonly Vec3[],
  cameraPosition: Vec3,
  forward: Vec3,
): number {
  const f = unitOf(forward)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis] ?? Infinity, point[axis] ?? Infinity)
      max[axis] = Math.max(max[axis] ?? -Infinity, point[axis] ?? -Infinity)
    }
  }
  let nearest = Infinity
  for (const x of [min[0] ?? 0, max[0] ?? 0]) {
    for (const y of [min[1] ?? 0, max[1] ?? 0]) {
      for (const z of [min[2] ?? 0, max[2] ?? 0]) {
        nearest = Math.min(nearest, dotOf(subOf([x, y, z], cameraPosition), f))
      }
    }
  }
  return nearest
}

// The storage allowance of one pose, as a share of the half frame: a
// position error of the given world size at the pose's nearest corner
// depth reads as this much less free frame, in the form the authoring
// side compares (free >= margin - allowance).
export function allowanceShareOf(
  worldError: number,
  nearestDepth: number,
  fovYRadians: number,
): number {
  if (nearestDepth <= 0) {
    throw new Error('the nearest bounding-box corner is behind the camera plane')
  }
  return worldError / (nearestDepth * Math.sin(fovYRadians / 2))
}

// One pose the home view must hold: its name, its stored vertices, and the
// world distance the file's own storage can move them by.
export type HomeFitPose = {
  readonly label: string
  readonly points: readonly Vec3[]
  readonly worldError: number
}

// What the home fit answers for one pose: the free share it measures, the
// storage allowance the pose spends, the nearest corner depth the allowance
// reads through, the index of the binding point, and whether the pose
// holds the margin beyond the allowance.
export type HomeFitVerdict = {
  readonly pose: string
  readonly free: number
  readonly allowance: number
  readonly nearestDepth: number
  readonly bindingPoint: number
  readonly holds: boolean
}

// Both poses' verdicts under one camera: the whole home fit in one pure
// pass, compared exactly against the margin less each pose's allowance.
export function homeFitVerdictsOf(
  poses: readonly HomeFitPose[],
  cameraPosition: Vec3,
  forward: Vec3,
  fovYRadians: number,
  aspect: number,
  margin: number,
): readonly HomeFitVerdict[] {
  return poses.map((pose) => {
    const extent = frameExtentOf(pose.points, cameraPosition, forward, fovYRadians, aspect)
    const nearestDepth = nearestCornerDepthOf(pose.points, cameraPosition, forward)
    const allowance = allowanceShareOf(pose.worldError, nearestDepth, fovYRadians)
    return {
      pose: pose.label,
      free: extent.free,
      allowance,
      nearestDepth,
      bindingPoint: extent.bindingPoint,
      holds: extent.free >= margin - allowance,
    }
  })
}

// A value in a report at five decimals: the free shares and allowances
// read against a 0.06 margin, so the noise one order below never shows.
export function round5(value: number): number {
  return Math.round(value * 100000) / 100000
}

function unitOf(vector: Vec3): Vec3 {
  const length = lengthOf(vector)
  if (length === 0) {
    throw new Error('a view direction cannot be the zero vector')
  }
  return scaleOf(vector, 1 / length)
}

// The roll-free right of a view direction over world up: the same basis
// the viewer rebuilds, degenerate only along world up, where the polar
// limits own the camera.
function rightOf(forward: Vec3): Vec3 {
  const right = crossOf(forward, WORLD_UP)
  const length = lengthOf(right)
  if (length < 1e-9) {
    throw new Error('a view straight along world up has no roll-free basis')
  }
  return scaleOf(right, 1 / length)
}

function subOf(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0)]
}

function scaleOf(a: Vec3, factor: number): Vec3 {
  return [(a[0] ?? 0) * factor, (a[1] ?? 0) * factor, (a[2] ?? 0) * factor]
}

function dotOf(a: Vec3, b: Vec3): number {
  return (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0)
}

function crossOf(a: Vec3, b: Vec3): Vec3 {
  return [
    (a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0),
    (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0),
    (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0),
  ]
}

function lengthOf(a: Vec3): number {
  return Math.sqrt(dotOf(a, a))
}
