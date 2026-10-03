import type { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, type PerspectiveCamera } from 'three'
import { zoomOfLens, lensOfZoom } from '@lib/camera/lens'
import { orbitAnglesOf } from '@lib/camera/view'
import type { CameraPlan, CameraView } from './productPlan'
import { applyView } from './controls'
import { STAGE_ASPECT, STEP, STEP_BUDGET } from './lensEaseFixtures'
import type { RestCounter } from './lensEaseFixtures'

// The eased move mechanics the lens ride tests assert with: the two
// channels a move between views eases (the zoom of the lens and the orbit
// radius), their fractions of the move at one step, the one-step fraction
// the smoothDamp recurrence predicts from rest, and the bands the
// controls' own rest threshold maps to at the landing.

// The proportionality bound of the two eased channels. They run the same
// linear smoothDamp recurrence with the same smooth time and the same step
// (camera-controls dist/camera-controls.module.js: the radius step
// :2129-2136, the zoom step :2159-2165, both linear in the change), so
// their fractions of the move agree up to the float rounding of the two
// arithmetic paths, a few ulps of one. Measured across the fixture moves,
// from rest and across a rest that still carries the previous move's
// residual velocity, the gap stays below nine ulps of one; the bound is
// the next power of two of one's ulp.
export const FRACTION_GAP = 16 * Number.EPSILON

// The two eased channels of a move onto a view, with the values their
// fractions of the move read against: the zoom of the lens and the orbit
// radius, each at the rest the move starts from and at the view it ends
// on. Both channels must change between the two views, since the fraction
// of a zero move is undefined.
export type EasedMove = {
  readonly zoomStart: number
  readonly zoomEnd: number
  readonly radiusStart: number
  readonly radiusEnd: number
}

export function easedMoveOf(
  plan: CameraPlan,
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
  view: CameraView,
): EasedMove {
  const move: EasedMove = {
    zoomStart: camera.zoom,
    zoomEnd: zoomOfLens(plan.baseFovY, view.fovY),
    radiusStart: controls.distance,
    radiusEnd: orbitAnglesOf(view.position, view.target).distance,
  }
  if (move.zoomStart === move.zoomEnd || move.radiusStart === move.radiusEnd) {
    throw new Error('a proportional move needs a view that changes both the zoom and the radius')
  }
  return move
}

// The fractions of their moves the two channels have covered at one step.
export type EaseFractions = {
  readonly zoomFraction: number
  readonly radiusFraction: number
}

export function fractionsOf(
  move: EasedMove,
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
): EaseFractions {
  return {
    zoomFraction: (camera.zoom - move.zoomStart) / (move.zoomEnd - move.zoomStart),
    radiusFraction: (controls.distance - move.radiusStart) / (move.radiusEnd - move.radiusStart),
  }
}

// The fraction of its change one smoothDamp step from rest moves: with
// x = 2 dt / smoothTime, the step leaves (1 + x) over
// (1 + x + 0.48 x^2 + 0.235 x^3) of the change, the velocity term
// included (camera-controls dist/camera-controls.module.js: smoothDamp
// :79-99).
export function oneStepFractionFromRest(smoothTime: number, dt: number): number {
  const x = (2 * dt) / smoothTime
  return 1 - (1 + x) / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
}

// The lens band the controls' rest threshold maps to at a view lens: the
// library rests when the zoom sits within restThreshold of its end
// (camera-controls dist/camera-controls.module.js: the rest condition
// includes the zoom delta :2270-2282), and this is the lens span that
// zoom error turns into through the base lens.
export function lensBandAtRest(
  controls: CameraControlsImpl,
  baseFovY: number,
  viewFovY: number,
): number {
  const threshold = controls.restThreshold
  const zoomEnd = zoomOfLens(baseFovY, viewFovY)
  return Math.max(
    Math.abs(lensOfZoom(baseFovY, zoomEnd + threshold) - viewFovY),
    Math.abs(lensOfZoom(baseFovY, zoomEnd - threshold) - viewFovY),
  )
}

// The position bound the same rest condition gives: the radius may miss by
// the threshold and each orbit angle by the threshold in radians, which
// swings an arc of radius times threshold each, and each of the three
// target components may miss by the threshold, so the position misses by
// at most threshold times (1 + 2 radius + sqrt(3)) of the view it lands
// on.
export function positionBandAtRest(controls: CameraControlsImpl, endDistance: number): number {
  return controls.restThreshold * (1 + 2 * endDistance + Math.sqrt(3))
}

// The lens the camera really presents, in radians, the read the automation
// and the projection both go through.
export function effectiveFovY(camera: PerspectiveCamera): number {
  return MathUtils.degToRad(camera.getEffectiveFOV())
}

// Requests the view with a transition and steps the controls until the
// move rests, recording the two channels' fractions of the move after
// every step. The loop stops on the controls' own rest event, the very
// event the returned promise resolves on, so the steps end exactly at the
// rest step; awaiting the promise after the loop proves that resolution.
export async function easeTo(
  plan: CameraPlan,
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
  view: CameraView,
  rests: RestCounter,
): Promise<EaseFractions[]> {
  const move = easedMoveOf(plan, controls, camera, view)
  const stopAt = rests.count
  const transition = applyView(controls, plan, view, STAGE_ASPECT, true)
  const steps: EaseFractions[] = []
  while (rests.count === stopAt && steps.length < STEP_BUDGET) {
    controls.update(STEP)
    steps.push(fractionsOf(move, controls, camera))
  }
  if (rests.count === stopAt) {
    throw new Error('the transition never rested within the step budget')
  }
  await transition
  return steps
}
