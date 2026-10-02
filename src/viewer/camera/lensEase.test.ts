import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MathUtils, Vector3 } from 'three'
import { DomRectStandIn, STAGE_ASPECT, staged, STEP, STEP_BUDGET, viewOf } from './lensEaseFixtures'
import {
  easeTo,
  effectiveFovY,
  FRACTION_GAP,
  fractionsOf,
  easedMoveOf,
  lensBandAtRest,
  oneStepFractionFromRest,
  positionBandAtRest,
} from './lensEaseMoves'
import { applyView } from './controls'
import { readCameraAutomation } from './useCameraAutomationSource'

// The eased lens ride, in Node on the real camera-controls: the lens is a
// zoom on the controls' own zoom channel, so it eases with the pose under
// one damping and lands at rest, forward, backward, superseded and without
// a transition. The staging lives in lensEaseFixtures.ts, the eased move
// mechanics in lensEaseMoves.ts.

// The controls' constructor fields two inert DOMRects, a browser global
// Node lacks: stubbed for this file's construction, unstubbed after.
beforeAll(() => {
  vi.stubGlobal('DOMRect', DomRectStandIn)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// The design claim of the ride, asserted at one step: the zoom channel and
// the radius channel have covered the same fraction of their moves, within
// the float rounding of the two arithmetic paths.
function expectProportional(fractions: { zoomFraction: number; radiusFraction: number }): void {
  expect(Math.abs(fractions.zoomFraction - fractions.radiusFraction)).toBeLessThanOrEqual(
    FRACTION_GAP,
  )
}

describe('the eased lens ride through the controls', () => {
  it('presents the base lens at the zoom 1 and the one clip range of the plan', () => {
    const { plan, camera } = staged()

    // The presented frame carries the home lens through the zoom 1. The
    // only inexactness is the degree round trip the camera's fov API
    // makes, hence the precision.
    expect(effectiveFovY(camera)).toBeCloseTo(viewOf(plan, 'home').fovY, 12)
    expect(camera.zoom).toBe(1)
    // The clip range of the whole plan, not the home view's planes: the
    // fixture close-up authors the smallest near and the home the largest
    // far.
    expect(camera.near).toBe(plan.clipRange.near)
    expect(camera.far).toBe(plan.clipRange.far)
  })

  it('eases the lens with the pose from the home lens to the close-up lens', async () => {
    const { plan, controls, camera, rests } = staged()
    const closeUp = viewOf(plan, 'driver')
    const closeUpFovY = closeUp.fovY

    const steps = await easeTo(plan, controls, camera, closeUp, rests)

    expect(steps.length).toBeGreaterThan(1)
    const step = (index: number): { zoomFraction: number; radiusFraction: number } => {
      const value = steps[index]
      if (value === undefined) {
        throw new Error(`the steps must cover step ${index}`)
      }
      return value
    }
    // The first step covers exactly what one smoothDamp step from rest
    // covers: a tiny fraction, not a jump.
    const oneStep = oneStepFractionFromRest(controls.smoothTime, STEP)
    expect(Math.abs(step(0).zoomFraction - oneStep)).toBeLessThanOrEqual(FRACTION_GAP)

    // Every step: the lens has covered the same fraction of its move as
    // the pose has of its own, one damping for both.
    for (const fractions of steps) {
      expectProportional(fractions)
    }

    // At rest the lens is the close-up's, within the band the controls'
    // rest threshold maps to, and the pose is the close-up's view.
    const band = lensBandAtRest(controls, plan.baseFovY, closeUpFovY)
    expect(Math.abs(effectiveFovY(camera) - closeUpFovY)).toBeLessThanOrEqual(band)
    const end = new Vector3(...closeUp.position)
    expect(camera.position.distanceTo(end)).toBeLessThanOrEqual(
      positionBandAtRest(controls, Math.hypot(...closeUp.position)),
    )
  })

  it('eases the reverse way from the close-up lens back to the home lens', async () => {
    const { plan, controls, camera, rests } = staged()
    const home = viewOf(plan, 'home')
    await easeTo(plan, controls, camera, viewOf(plan, 'driver'), rests)

    const steps = await easeTo(plan, controls, camera, home, rests)

    expect(steps.length).toBeGreaterThan(1)
    // Every step: the lens has covered the same fraction of its move as
    // the pose has of its own, one damping for both. The one-step formula
    // is not asserted here: this move starts from the previous move's
    // rest, which still carries a residual velocity, so its first step is
    // not a from-rest step.
    for (const fractions of steps) {
      expectProportional(fractions)
    }
    const band = lensBandAtRest(controls, plan.baseFovY, home.fovY)
    expect(Math.abs(effectiveFovY(camera) - home.fovY)).toBeLessThanOrEqual(band)
  })

  it("lands a transition superseded mid-way on the third view's lens", async () => {
    const { plan, controls, camera, rests } = staged()
    const homeFovY = viewOf(plan, 'home').fovY
    const closeUpFovY = viewOf(plan, 'driver').fovY
    const midFovY = viewOf(plan, 'shell').fovY
    const midView = viewOf(plan, 'shell')

    // The first move eases from rest, so its two channels are proportional
    // at every step of the segment it survives.
    const move = easedMoveOf(plan, controls, camera, viewOf(plan, 'driver'))
    const superseded = applyView(controls, plan, viewOf(plan, 'driver'), STAGE_ASPECT, true)
    for (let step = 0; step < 30; step += 1) {
      controls.update(STEP)
      expectProportional(fractionsOf(move, controls, camera))
    }
    // Mid-way: the lens sits between the two lenses it was easing between.
    const midFlight = effectiveFovY(camera)
    expect(midFlight).toBeLessThan(homeFovY)
    expect(midFlight).toBeGreaterThan(closeUpFovY)

    // After the supersede the proportionality is not asserted: the two
    // channels then continue with different velocities from the mid-flight
    // state, so their per-step fractions diverge even though both still
    // converge under the same damping. The landing below pins the outcome.
    const stopAt = rests.count
    const third = applyView(controls, plan, midView, STAGE_ASPECT, true)
    let steps = 0
    while (rests.count === stopAt && steps < STEP_BUDGET) {
      controls.update(STEP)
      steps += 1
    }
    if (rests.count === stopAt) {
      throw new Error('the superseding transition never rested within the step budget')
    }
    await Promise.all([superseded, third])

    // Both promises resolved on the same rest, and that rest is the third
    // view's: the superseded move neither finished first nor left the lens
    // behind.
    expect(Math.abs(effectiveFovY(camera) - midFovY)).toBeLessThanOrEqual(
      lensBandAtRest(controls, plan.baseFovY, midFovY),
    )
    const end = new Vector3(...midView.position)
    expect(camera.position.distanceTo(end)).toBeLessThanOrEqual(
      positionBandAtRest(controls, Math.hypot(...midView.position)),
    )
  })

  it('moves lens and pose at once when the view applies without a transition', async () => {
    const { plan, controls, camera } = staged()
    const closeUpFovY = viewOf(plan, 'driver').fovY

    await applyView(controls, plan, viewOf(plan, 'driver'), STAGE_ASPECT, false)
    controls.update(STEP)

    // One frame carries both to the close-up: the zoom landed at once, so
    // the effective lens is the close-up's to float rounding, and the pose
    // is the controls' own end state. The end state and the camera
    // position decompose the same spherical state through the same trig
    // path, so the two agree to a few ulps of the distance.
    expect(effectiveFovY(camera)).toBeCloseTo(closeUpFovY, 12)
    const end = controls.getPosition(new Vector3(), true)
    expect(camera.position.distanceTo(end)).toBeLessThanOrEqual(4 * Number.EPSILON * end.length())
  })

  it('reads the effective lens into the automation while the zoom is other than 1', async () => {
    const { plan, controls, camera, rests } = staged()
    const closeUpFovY = viewOf(plan, 'driver').fovY
    await easeTo(plan, controls, camera, viewOf(plan, 'driver'), rests)

    const read = readCameraAutomation(controls, camera)

    // The zoom presents the close-up lens through the base lens, and the
    // automation reports that lens: at rest the read sits within the rest
    // band of the close-up lens, and further from the base fov the camera
    // still carries than the band allows, so the read names the effective
    // lens, not the base.
    const band = lensBandAtRest(controls, plan.baseFovY, closeUpFovY)
    expect(Math.abs(read.fovY - closeUpFovY)).toBeLessThanOrEqual(band)
    expect(Math.abs(read.fovY - MathUtils.degToRad(camera.fov))).toBeGreaterThan(band)
  })
})
