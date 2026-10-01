// The map from the exploded view's normalized progress to the clip time of
// the product's one animation. Pure math over numbers: no three import, no
// viewer code, so the store slice and the scene feature share one rule.

// The typed failure of an out-of-range progress. Callers never clamp
// silently: a progress past the ends is a programming error at whoever
// produced it, and hiding it would play the wrong pose.
export class ExplodeRangeError extends RangeError {
  constructor(message: string) {
    super(message)
    this.name = 'ExplodeRangeError'
  }
}

export const EXPLODE_T_MIN = 0
export const EXPLODE_T_MAX = 1

// Checks one normalized progress and returns it. NaN fails both comparisons
// below, so a missing number is an out-of-range one, not a pass.
export function checkExplodeT(t: number): number {
  if (!(t >= EXPLODE_T_MIN && t <= EXPLODE_T_MAX)) {
    throw new ExplodeRangeError(`explode progress must lie in [0, 1], got ${t}`)
  }
  return t
}

// The clip time the progress maps to: t = 0 is the clip's first keyframe,
// t = 1 its last. The multiplication keeps t = 1 exactly at the duration,
// which is the last key time the loader computes, so the end pose is sampled
// at its own key and not a rounding step past it.
export function explodeClipTime(t: number, durationSeconds: number): number {
  checkExplodeT(t)
  return t * durationSeconds
}
