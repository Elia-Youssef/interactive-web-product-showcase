import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DomRectStandIn, STEP_BUDGET, staged } from './lensEaseFixtures'
import { FRACTION_GAP, oneStepFractionFromRest } from './lensEaseMoves'
import { ControlsFrameClock } from './controlsFrameClock'

// The controls' frame clock: the step rule through the state the mount
// hook drives, over the table of frame, move and motion timings, and on
// the real controls the first frame of a move that starts after an idle.
// The per-frame input scenarios live in controlsFrameInput.test.ts, the
// staging in lensEaseFixtures.ts, the eased move mechanics in
// lensEaseMoves.ts.

// The steady display the virtual timeline runs at, in milliseconds.
const FRAME_MS = 1000 / 60

// The controls' constructor fields two inert DOMRects, a browser global
// Node lacks: stubbed for this file's construction, unstubbed after.
beforeAll(() => {
  vi.stubGlobal('DOMRect', DomRectStandIn)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('ControlsFrameClock', () => {
  it('steps a running motion by the frame gap, input steps or not', () => {
    const clock = new ControlsFrameClock()
    clock.stepSeconds(1000)
    clock.recordUpdate(true)
    // An input step lands 1.5 ms before every frame; the step is the gap.
    clock.beginMove(1015.2)
    expect(clock.stepSeconds(1016.7)).toBeCloseTo(16.7 / 1000, 12)
    clock.recordUpdate(true)
    clock.beginMove(1031.9)
    expect(clock.stepSeconds(1033.4)).toBeCloseTo(16.7 / 1000, 12)
  })

  it('steps a frame after a superseding move while in motion by the frame gap', () => {
    const clock = new ControlsFrameClock()
    clock.beginMove(1990)
    clock.stepSeconds(2000)
    clock.recordUpdate(true)
    // The supersede lands 1.5 ms before its frame and must not restart
    // the clock: the time since the previous frame was motion time.
    clock.beginMove(2015.2)
    expect(clock.stepSeconds(2016.7)).toBeCloseTo(16.7 / 1000, 12)
  })

  it('steps a move that starts after the controls slept by the move age', () => {
    const clock = new ControlsFrameClock()
    clock.stepSeconds(1000)
    clock.recordUpdate(false)
    clock.beginMove(4990)
    expect(clock.stepSeconds(5000)).toBeCloseTo(10 / 1000, 12)
  })

  it('steps the frame after the controls fell asleep and a move started, from the move start', () => {
    const clock = new ControlsFrameClock()
    clock.stepSeconds(2000)
    clock.recordUpdate(false)
    clock.beginMove(2010)
    expect(clock.stepSeconds(2016.7)).toBeCloseTo(6.7 / 1000, 12)
  })

  it('keeps the frame gap for frames that run while the controls sleep', () => {
    const clock = new ControlsFrameClock()
    clock.stepSeconds(2000)
    clock.recordUpdate(false)
    expect(clock.stepSeconds(2016.7)).toBeCloseTo(16.7 / 1000, 12)
    clock.recordUpdate(false)
    expect(clock.stepSeconds(2033.4)).toBeCloseTo(16.7 / 1000, 12)
    // A move that then starts anchors the next step at its own start.
    clock.recordUpdate(false)
    clock.beginMove(2048)
    expect(clock.stepSeconds(2050)).toBeCloseTo(2 / 1000, 12)
  })

  it('steps a first moving step short after a press that moved nothing', () => {
    const clock = new ControlsFrameClock()
    clock.stepSeconds(1985)
    clock.recordUpdate(false)
    // The press (controlstart) anchors, and moves nothing yet.
    clock.beginMove(1990)
    expect(clock.stepSeconds(2000)).toBeCloseTo(10 / 1000, 12)
    clock.recordUpdate(false)
    // The first pointermove lands 1.5 ms before its frame: that first
    // moving step is its 1.5 ms, then the stream steps by the gap.
    clock.beginMove(2015.2)
    expect(clock.stepSeconds(2016.7)).toBeCloseTo(1.5 / 1000, 12)
    clock.recordUpdate(true)
    expect(clock.stepSeconds(2033.4)).toBeCloseTo(16.7 / 1000, 12)
  })

  it('steps zero on the first frame before any move, then by the gap', () => {
    const clock = new ControlsFrameClock()
    expect(clock.stepSeconds(100)).toBe(0)
    clock.recordUpdate(true)
    // In motion from the next frame on: the step is the gap.
    expect(clock.stepSeconds(116.7)).toBeCloseTo(16.7 / 1000, 12)
  })

  it('steps a first frame that follows a move already begun from the move start', () => {
    const clock = new ControlsFrameClock()
    clock.beginMove(4990)
    expect(clock.stepSeconds(5000)).toBeCloseTo(10 / 1000, 12)
  })
})

describe('the first frame of a move after an idle, on the real controls', () => {
  it('steps the fraction a one-frame step predicts, not the fraction over the idle', async () => {
    const { controls, rests } = staged()
    const clock = new ControlsFrameClock()
    // The virtual timeline: the event that starts a move records itself at
    // its own time, the way the mount hook records performance.now at the
    // controls' event.
    let nowMs = 0
    controls.addEventListener('transitionstart', () => clock.beginMove(nowMs))

    // A few steady frames at rest, then the 2 s idle the stage sits
    // through with no frame at all.
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += FRAME_MS
      clock.recordUpdate(controls.update(clock.stepSeconds(nowMs)))
    }
    nowMs += 2000

    // The move starts at the click: the controls dispatch
    // transitionstart synchronously, and the first presented frame lands
    // one frame gap later.
    const start = controls.distance
    const end = controls.distance * 0.8
    const stopAt = rests.count
    const transition = controls.dollyTo(end, true)
    nowMs += FRAME_MS
    clock.recordUpdate(controls.update(clock.stepSeconds(nowMs)))

    // The first frame moved exactly what one smoothDamp step from rest at
    // the frame gap moves, within the float rounding of the two arithmetic
    // paths. The step formula's premise holds: the stage idled only after
    // the controls slept, and sleep zeroes the velocities the recurrence
    // would otherwise carry over.
    const fraction = (controls.distance - start) / (end - start)
    const oneStep = oneStepFractionFromRest(controls.smoothTime, FRAME_MS / 1000)
    expect(fraction).toBeGreaterThan(0)
    expect(Math.abs(fraction - oneStep)).toBeLessThanOrEqual(FRACTION_GAP)

    // The move still eases to its end and rests, and the promise resolves
    // on that rest.
    let steps = 1
    while (rests.count === stopAt && steps < STEP_BUDGET) {
      nowMs += FRAME_MS
      clock.recordUpdate(controls.update(clock.stepSeconds(nowMs)))
      steps += 1
    }
    if (rests.count === stopAt) {
      throw new Error('the transition never rested within the step budget')
    }
    await transition
    // The controls rest when the remaining delta drops below their rest
    // threshold (camera-controls dist/camera-controls.module.js, the rest
    // condition), so the radius may miss the end by that much.
    expect(Math.abs(controls.distance - end)).toBeLessThanOrEqual(controls.restThreshold)
  })
})
