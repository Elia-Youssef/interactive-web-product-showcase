// The orbit step rule of the stage camera: what one rotate or tilt step
// asks for, where it ends, and whether it reached a tilt limit. Pure math
// over the controls' end state, so a button, a key and a test read the same
// rule. The sign follows the drag: a step to the right turns the product to
// the right exactly as dragging right does, which lowers the azimuth, and a
// step up lifts its front the way dragging up does, which raises the polar
// angle.

import { degreesToRadians, type PolarRange } from './limits'
import type { OrbitAngles } from './view'

// The four ways a step turns the product.
export type OrbitDirection = 'left' | 'right' | 'up' | 'down'

// The two step sizes: the plain step, and the fine one a held Shift asks for.
export type OrbitStepSize = 'coarse' | 'fine'

// The step sizes, in degrees, from the camera config.
export type OrbitStepConfig = {
  readonly rotateStepDegrees: number
  readonly tiltStepDegrees: number
  readonly fineStepDegrees: number
}

// A turn of the orbit, in degrees: the azimuth change and the polar change.
// Two turns add, so turns asked for within one frame merge into one.
export type OrbitTurn = {
  readonly azimuthDegrees: number
  readonly polarDegrees: number
}

// The two angles a turn changes, in radians: the distance is the zoom's.
export type OrbitTurnAngles = Pick<OrbitAngles, 'azimuth' | 'polar'>

// The tilt limit an end polar angle sits at: the top view at the polar
// minimum (the camera nearest straight up), the bottom view at the maximum.
export type TiltLimit = 'top' | 'bottom'

const signOf: Readonly<Record<OrbitDirection, 1 | -1>> = {
  left: 1,
  right: -1,
  up: 1,
  down: -1,
}

const axisOf: Readonly<Record<OrbitDirection, 'azimuth' | 'polar'>> = {
  left: 'azimuth',
  right: 'azimuth',
  up: 'polar',
  down: 'polar',
}

// The turn one step in a direction asks for, at a step size.
export function orbitTurnOf(
  direction: OrbitDirection,
  size: OrbitStepSize,
  config: OrbitStepConfig,
): OrbitTurn {
  const axis = axisOf[direction]
  const coarse = axis === 'azimuth' ? config.rotateStepDegrees : config.tiltStepDegrees
  const degrees = signOf[direction] * (size === 'fine' ? config.fineStepDegrees : coarse)
  return axis === 'azimuth'
    ? { azimuthDegrees: degrees, polarDegrees: 0 }
    : { azimuthDegrees: 0, polarDegrees: degrees }
}

export function addOrbitTurns(a: OrbitTurn, b: OrbitTurn): OrbitTurn {
  return {
    azimuthDegrees: a.azimuthDegrees + b.azimuthDegrees,
    polarDegrees: a.polarDegrees + b.polarDegrees,
  }
}

// Where a turn from the end angles ends: the azimuth adds without a bound,
// and the polar angle clamps to the plan's range, exactly at its limits, so
// steps that run past a limit stop on it.
export function steppedOrbit(
  end: OrbitTurnAngles,
  turn: OrbitTurn,
  range: PolarRange,
): OrbitTurnAngles {
  const polar = end.polar + degreesToRadians(turn.polarDegrees)
  return {
    azimuth: end.azimuth + degreesToRadians(turn.azimuthDegrees),
    polar: Math.min(Math.max(polar, range.min), range.max),
  }
}

// Whether a tilt step in this direction can move from the end polar angle:
// up while the end sits below the maximum, down while it sits above the
// minimum. Exact comparisons: the controls hold a reached limit exactly.
export function tiltStepMoves(
  endPolar: number,
  range: PolarRange,
  direction: Extract<OrbitDirection, 'up' | 'down'>,
): boolean {
  return direction === 'up' ? endPolar < range.max : endPolar > range.min
}

// The tilt limit the end polar angle sits at, or null inside the range.
export function tiltLimitOf(endPolar: number, range: PolarRange): TiltLimit | null {
  if (endPolar === range.min) {
    return 'top'
  }
  if (endPolar === range.max) {
    return 'bottom'
  }
  return null
}
