// The spring that drives the exploded view's progress between 0 and 1.
// Pure math over numbers: no three import, no clock, no frame loop. The
// caller feeds it the elapsed seconds of whatever stepped, so the motion is
// independent of the frame rate.

// The state of the motion: the progress value and its first derivative.
// Values the spring itself produced always lie in [0, 1] when the targets
// do; the no-overshoot property is pinned by the spring tests.
export type SpringState = {
  readonly value: number
  readonly velocity: number
}

// The motion's tunables, as springSettings builds them: the units live in
// the names, and the angular speed is derived once so no per-frame call
// re-derives it.
export type SpringSettings = {
  // The time a full move from one end to the other, started at rest, needs
  // to first reach the rest band, in seconds.
  readonly settleSeconds: number
  // The distance to the target below which the motion ends by snapping to
  // it, in progress units (a fraction of the full travel).
  readonly restThreshold: number
  // omega of the critically damped system, in radians per second.
  readonly omegaRadiansPerSecond: number
}

// One step of the motion, written into a target the caller owns: the
// state after elapsedSeconds toward the target, and whether the step ended
// the motion, either because the step snapped or because the state was
// already at rest.
export type SpringStepTarget = {
  value: number
  velocity: number
  atRest: boolean
}

// At rest means the motion is finished: exactly on the target with no
// velocity left. Only the rest snap produces that state, so the comparison
// is exact and demand-mode render loops can stop on it.
export function isSpringAtRest(state: SpringState, target: number): boolean {
  return state.value === target && state.velocity === 0
}

// Validates the two tunables and derives omega. The rest band solves the
// settle time exactly: a critically damped spring started at rest with any
// gap g sits g * (1 + u) * exp(-u) from its target at u = omega * t, so the
// move enters the band when (1 + u) * exp(-u) equals the threshold. That
// equation has one root above zero for a threshold in (0, 1), found below,
// and omega = u / settleSeconds makes a full move reach rest at
// settleSeconds, which is what the config states.
export function springSettings(settleSeconds: number, restThreshold: number): SpringSettings {
  if (!(settleSeconds > 0) || !Number.isFinite(settleSeconds)) {
    throw new RangeError(
      `the spring settle time must be a positive number of seconds, got ${settleSeconds}`,
    )
  }
  if (!(restThreshold > 0) || restThreshold >= 1 || !Number.isFinite(restThreshold)) {
    throw new RangeError(`the spring rest threshold must lie in (0, 1), got ${restThreshold}`)
  }
  const omega = restExponent(restThreshold) / settleSeconds
  return { settleSeconds, restThreshold, omegaRadiansPerSecond: omega }
}

// Steps the state toward the target over elapsedSeconds, filling the
// caller-owned target record. Critically damped, so the value approaches
// the target without crossing it for every state the spring itself
// produced, and the exact closed form makes one long step land where many
// short steps land, within float rounding.
//
// The rest rule ends the motion: within the threshold of the target the
// step snaps exactly onto it with no velocity, so the caller can stop
// invalidating a demand-mode frame loop on an exact comparison.
export function stepSpring(
  state: SpringState,
  target: number,
  elapsedSeconds: number,
  settings: SpringSettings,
  into: SpringStepTarget,
): void {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError(
      `the spring step needs a non-negative elapsed time in seconds, got ${elapsedSeconds}`,
    )
  }
  if (isSpringAtRest(state, target)) {
    into.value = state.value
    into.velocity = 0
    into.atRest = true
    return
  }
  const gap = state.value - target
  // The start side of the band needs no rounding allowance: the comparison
  // only matters when the two operands are within the band of each other,
  // and there they are within a factor of two, so their subtraction is
  // exact (Sterbenz). A wide gap rounds, but stays far from the edge.
  if (Math.abs(gap) <= settings.restThreshold) {
    into.value = target
    into.velocity = 0
    into.atRest = true
    return
  }
  const omega = settings.omegaRadiansPerSecond
  // The closed form of x'' = omega^2 (target - x) - 2 omega x', whose
  // solution is target + (gap + u t) exp(-omega t) with u = velocity +
  // omega gap.
  const slope = state.velocity + omega * gap
  const decay = Math.exp(-omega * elapsedSeconds)
  const offset = gap + slope * elapsedSeconds
  const landing = offset * decay
  // The landing side compares the composed magnitude itself, never the
  // value recomposed through the target: subtracting back rounds at the
  // progress scale, an ulp of 1, while every rounding on this path is an
  // ulp of the distance it feeds. Enumerated, each at half an ulp of what
  // it produces, in units of the distance d: the omega*gap product (damped
  // by elapsed and decay), the slope sum (same), the slope*elapsed product,
  // the offset sum, the exp (relative), and this product. Six half-ulps of
  // d, three full ulps of d, and at the band edge d is the threshold, so
  // the band grows by exactly that derived slack and no more.
  const restBand = settings.restThreshold * (1 + 3 * Number.EPSILON)
  // The rest rule applies to the landing too: a step that arrives inside
  // the band ends the motion there, exactly on the target with no velocity
  // left, so the caller can stop invalidating on an exact comparison.
  if (Math.abs(landing) <= restBand) {
    into.value = target
    into.velocity = 0
    into.atRest = true
    return
  }
  into.value = target + landing
  into.velocity = (slope - omega * offset) * decay
  into.atRest = false
}

// The u where a critically damped spring started at rest first enters its
// rest band: the root of (1 + u) exp(-u) = threshold. The function falls
// monotonically from 1 toward 0 above u = 0, so a bracket that doubles
// until it holds the root always finds one, and halving it always closes
// in. The loop ends when the midpoint stops moving on the float grid; the
// cap is a backstop that throws instead of returning an unsettled guess,
// and the returned edge is the one whose value already sits inside the
// band, which is the side the settle-time property needs.
function restExponent(threshold: number): number {
  let low = 0
  let high = 1
  while ((1 + high) * Math.exp(-high) > threshold) {
    high *= 2
    if (!Number.isFinite(high)) {
      throw new RangeError(`the rest threshold ${threshold} has no rest exponent`)
    }
  }
  let u = (low + high) / 2
  for (let step = 0; step < 200; step += 1) {
    if ((1 + u) * Math.exp(-u) > threshold) {
      low = u
    } else {
      high = u
    }
    const middle = (low + high) / 2
    if (middle === u) {
      return high
    }
    u = middle
  }
  throw new Error(`the rest exponent for the threshold ${threshold} did not settle`)
}
