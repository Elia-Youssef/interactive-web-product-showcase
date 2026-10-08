// The distance and polar limit rules of the stage camera, as pure checks
// over the authored data. Authored data is never clamped: a rule that
// breaks is a problem naming the values, and the product fails on it.
// The limit values themselves live in ./config, the one place the runtime
// and the build-time validate step read them from.

import type { CameraLimitConfig } from './config'
import { farthestPointFrom } from './frame'
import type { ModelBounds, Vec3 } from './frame'

export type DistanceRange = {
  // The closest the camera may come to the target, in stage units at the
  // authored aspect.
  readonly min: number
  // The farthest it may go.
  readonly max: number
}

export type PolarRange = {
  // The steepest allowed angle above the target, in radians from +Y.
  readonly min: number
  // The shallowest allowed angle below it.
  readonly max: number
}

// The authored distance limits of a product manifest, in stage units at the
// authored aspect. Both sides are optional.
export type AuthoredDistanceLimits = {
  readonly minDistance?: number
  readonly maxDistance?: number
}

// The fallback limits as ratios of the authored home distance, used for
// each side the manifest does not author.
export type HomeDistanceRatios = {
  readonly minRatio: number
  readonly maxRatio: number
}

// A rule that the authored camera data breaks, with the values named.
export type CameraLimitProblem = {
  readonly rule: string
  readonly message: string
}

// The orbit numbers of one named view: the CAM_ identity a problem names,
// the orbit target the reach rules measure from, the orbit distance and
// polar angle the limit rules check, the model's reach from that target
// (its farthest point from it), and what the target was projected from, as
// the reach rule names it. Every view of the plan is checked, the home view
// included.
export type ViewOrbit = {
  readonly id: string
  readonly target: Vec3
  readonly distance: number
  readonly polar: number
  readonly reach: number
  readonly pivot: string
}

// The distance limits of a product: each authored side wins; a side the
// manifest does not author is a ratio of the authored home distance.
export function resolvedDistanceLimits(
  authored: AuthoredDistanceLimits,
  homeDistance: number,
  ratios: HomeDistanceRatios,
): DistanceRange {
  return {
    min: authored.minDistance ?? homeDistance * ratios.minRatio,
    max: authored.maxDistance ?? homeDistance * ratios.maxRatio,
  }
}

// The polar limits of a product, in radians: the configured degrees
// converted the way three's MathUtils.degToRad converts them, so the rules
// read the same range on every side.
export function resolvedPolarRange(limits: CameraLimitConfig): PolarRange {
  return {
    min: degreesToRadians(limits.minPolarAngleDegrees),
    max: degreesToRadians(limits.maxPolarAngleDegrees),
  }
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// The distance rules: every view's orbit distance must lie within [min, max]
// (a view exactly at a limit is within). A problem names the view it failed on.
export function distanceLimitProblems(
  range: DistanceRange,
  views: readonly ViewOrbit[],
): readonly CameraLimitProblem[] {
  const problems: CameraLimitProblem[] = []
  for (const view of views) {
    if (view.distance < range.min || view.distance > range.max) {
      problems.push({
        rule: 'view-within-distance-limits',
        message: `the CAM_${view.id} distance ${view.distance} lies outside the distance limits [${range.min}, ${range.max}]`,
      })
    }
  }
  return problems
}

// The polar rule: every view's polar angle must lie within the configured
// polar limits, in radians, so every view is reachable by orbiting. A
// problem names the view it failed on.
export function polarLimitProblems(
  polar: PolarRange,
  views: readonly ViewOrbit[],
): readonly CameraLimitProblem[] {
  const problems: CameraLimitProblem[] = []
  for (const view of views) {
    if (view.polar < polar.min || view.polar > polar.max) {
      problems.push({
        rule: 'view-within-polar-limits',
        message: `the CAM_${view.id} polar angle ${view.polar} lies outside the polar limits [${polar.min}, ${polar.max}]`,
      })
    }
  }
  return problems
}

// The reach rule: for every view, home included, the minimum distance must
// exceed the model's farthest point from that view's orbit target, so no
// orbit or dolly within the limits can bring the camera into the product.
// A minimum exactly at the reach puts the camera on the model's surface,
// so it fails. The model's radius around its center is the special case of
// a target at the center, and no target reaches less far than the radius,
// so this one rule covers what a radius rule would. A problem names the
// product, the view, the pivot and both numbers.
export function reachLimitProblems(
  range: DistanceRange,
  views: readonly ViewOrbit[],
  product: string,
): readonly CameraLimitProblem[] {
  const problems: CameraLimitProblem[] = []
  for (const view of views) {
    if (range.min <= view.reach) {
      problems.push({
        rule: 'minimum-clears-reach',
        message: `the ${product} CAM_${view.id} minimum distance ${range.min} does not exceed the model reach ${view.reach} from its orbit target, projected from ${view.pivot}`,
      })
    }
  }
  return problems
}

// The reach rule at the explode's last key: the minimum distance must also
// exceed the model's farthest point from the home view's orbit target over
// the parts' bounds at the fully exploded pose, the shadow excluded (the
// viewer has faded it out by that end of the clip). Home is the one view a
// visitor orbits while the product is exploded: the close-ups apply only to
// the assembled product, so the exploded pose is home's clause alone. A
// problem names the product, the view, the pivot and both numbers, and says
// which end of the clip it measured.
export function explodedReachLimitProblems(
  range: DistanceRange,
  home: ViewOrbit,
  explodedBounds: ModelBounds,
  product: string,
): readonly CameraLimitProblem[] {
  const reach = farthestPointFrom(explodedBounds, home.target)
  if (range.min > reach) {
    return []
  }
  return [
    {
      rule: 'minimum-clears-exploded-reach',
      message:
        `the ${product} CAM_${home.id} minimum distance ${range.min} does not exceed the model reach ` +
        `${reach} at the explode's last key from its orbit target, projected from ${home.pivot}`,
    },
  ]
}
