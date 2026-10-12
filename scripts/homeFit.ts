// The home fit (contract C5) as pure math: how much of the half frame a
// pose keeps free around the product, seen through the authored home
// camera, compared with the margin exactly. The points are the stored
// vertices the viewer draws, so no allowance for the file's storage enters
// the comparison: the authoring side folds the storage shift into its own
// fit. The projection is the one the viewer rebuilds for a presented view:
// the camera's stored ray and vertical fov, the authored aspect (any
// positive width over height), vertical fit, a roll-free basis over world
// up.

import type { Vec3 } from '../src/lib/camera/frame.ts'
import { dot, rollFreeBasisOf, sub, unitOf } from './viewBasis.ts'

// What projecting a pose answers: the frame extent, or the reason the pose
// has none through this camera. A point behind the camera plane has no
// screen position at all, and a view straight along world up has no
// roll-free basis to project with; both are facts of the file, reported by
// the rule, never thrown.
export type FrameExtent =
  | {
      readonly kind: 'extent'
      readonly x: [number, number]
      readonly y: [number, number]
      readonly free: number
      readonly bindingPoint: number
    }
  | { readonly kind: 'behindCamera'; readonly point: number }
  | { readonly kind: 'noRollFreeBasis' }

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
): FrameExtent {
  const f = unitOf(forward)
  const basis = rollFreeBasisOf(f)
  if (basis === null) {
    return { kind: 'noRollFreeBasis' }
  }
  const { right: r, up: u } = basis
  const t = Math.tan(fovYRadians / 2)
  const xs: number[] = []
  const ys: number[] = []
  let reach = -Infinity
  let bindingPoint = 0
  for (const [index, point] of points.entries()) {
    const q = sub(point, cameraPosition)
    const depth = dot(q, f)
    if (depth <= 0) {
      return { kind: 'behindCamera', point: index }
    }
    const x = dot(q, r) / (depth * t * aspect)
    const y = dot(q, u) / (depth * t)
    xs.push(x)
    ys.push(y)
    const abs = Math.max(Math.abs(x), Math.abs(y))
    if (abs > reach) {
      reach = abs
      bindingPoint = index
    }
  }
  return {
    kind: 'extent',
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
    free: 1 - reach,
    bindingPoint,
  }
}

// One pose the home view must hold: its name and its stored vertices.
export type HomeFitPose = {
  readonly label: string
  readonly points: readonly Vec3[]
}

// What the home fit answers for one pose: the free share it measures, the
// index of the binding point, and whether the pose keeps the margin.
export type HomeFitVerdict = {
  readonly pose: string
  readonly free: number
  readonly bindingPoint: number
  readonly holds: boolean
}

// One pose's verdict, or the pose the camera cannot project with the
// reason: what the home fit answers per pose.
export type PoseOutcome =
  | ({ readonly kind: 'verdict' } & HomeFitVerdict)
  | {
      readonly kind: 'unprojectable'
      readonly pose: string
      readonly extent: Exclude<FrameExtent, { kind: 'extent' }>
    }

// Both poses' verdicts under one camera: the whole home fit in one pure
// pass, each free share compared exactly against the margin.
export function homeFitVerdictsOf(
  poses: readonly HomeFitPose[],
  cameraPosition: Vec3,
  forward: Vec3,
  fovYRadians: number,
  aspect: number,
  margin: number,
): readonly PoseOutcome[] {
  return poses.map((pose) => {
    const extent = frameExtentOf(pose.points, cameraPosition, forward, fovYRadians, aspect)
    if (extent.kind !== 'extent') {
      return { kind: 'unprojectable', pose: pose.label, extent }
    }
    return {
      kind: 'verdict',
      pose: pose.label,
      free: extent.free,
      bindingPoint: extent.bindingPoint,
      holds: extent.free >= margin,
    }
  })
}

// The decimals that tell a measured share from the margin it is held to:
// the fewest, from four up, at which the two no longer print alike, so a
// pose short by a hundred-thousandth never reads as the margin itself.
export function decimalsApart(value: number, margin: number): number {
  for (let decimals = 4; decimals < 17; decimals += 1) {
    if (value.toFixed(decimals) !== margin.toFixed(decimals)) {
      return decimals
    }
  }
  return 17
}
