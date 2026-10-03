// The distance and polar limit rules of the stage camera, as pure checks
// over the authored data. Authored data is never clamped: a rule that
// breaks is a problem naming the values, and the product fails on it.
// The limit values themselves live in ./config, the one place the runtime
// and the build-time validate step read them from.

import type { CameraLimitConfig } from './config'

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

// The orbit angles of one named view: the CAM_ identity a problem names,
// and the two values the limit rules check. Every view of the plan is
// checked, the home view included.
export type ViewOrbit = {
  readonly id: string
  readonly distance: number
  readonly polar: number
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
// (a view exactly at a limit is within), and the minimum must exceed the
// model frame's radius, so the camera never enters the model. A problem
// names the view it failed on.
export function distanceLimitProblems(
  range: DistanceRange,
  views: readonly ViewOrbit[],
  radius: number,
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
  if (range.min <= radius) {
    problems.push({
      rule: 'minimum-clears-the-model',
      message: `the minimum distance ${range.min} does not exceed the model radius ${radius}`,
    })
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
