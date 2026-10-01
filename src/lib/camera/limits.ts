// The distance and polar limit rules of the stage camera, as pure checks
// over the authored data. Authored data is never clamped: a rule that
// breaks is a problem naming the values, and the product fails on it.

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

// The distance rules: the home distance must lie within [min, max] (a home
// exactly at a limit is within), and the minimum must exceed the model
// frame's radius, so the camera never enters the model.
export function distanceLimitProblems(
  range: DistanceRange,
  homeDistance: number,
  radius: number,
): readonly CameraLimitProblem[] {
  const problems: CameraLimitProblem[] = []
  if (homeDistance < range.min || homeDistance > range.max) {
    problems.push({
      rule: 'home-within-distance-limits',
      message: `the home distance ${homeDistance} lies outside the distance limits [${range.min}, ${range.max}]`,
    })
  }
  if (range.min <= radius) {
    problems.push({
      rule: 'minimum-clears-the-model',
      message: `the minimum distance ${range.min} does not exceed the model radius ${radius}`,
    })
  }
  return problems
}

// The polar rule: the home polar angle must lie within the configured polar
// limits, in radians, or the home view is unreachable by orbiting.
export function polarLimitProblems(
  polar: PolarRange,
  homePolar: number,
): readonly CameraLimitProblem[] {
  if (homePolar < polar.min || homePolar > polar.max) {
    return [
      {
        rule: 'home-within-polar-limits',
        message: `the home polar angle ${homePolar} lies outside the polar limits [${polar.min}, ${polar.max}]`,
      },
    ]
  }
  return []
}
