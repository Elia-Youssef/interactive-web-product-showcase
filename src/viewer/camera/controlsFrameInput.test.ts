import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CameraControlsImpl } from '@react-three/drei'
import { DomRectStandIn, staged, viewOf } from './lensEaseFixtures'
import { applyView } from './controls'
import { FRAME_MS, STAGE_ASPECT, runScenarioBothWays } from './perFrameInputFixtures'

// The per-frame input scenarios of the controls' frame clock, on the real
// controls: a steady drag, a wheel stream and a transition superseded
// mid-flight, each delivering an input step per presented frame. The rule
// under test: a frame whose input ends an idle steps the input lead, every
// in-motion frame steps the frame gap, and the camera path is identical,
// exactly, to the same inputs stepped by those gaps. The staging lives in
// lensEaseFixtures.ts, the schedules in perFrameInputFixtures.ts.

// The controls' constructor fields two inert DOMRects, a browser global
// Node lacks: stubbed for this file's construction, unstubbed after.
beforeAll(() => {
  vi.stubGlobal('DOMRect', DomRectStandIn)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// The shared comparison: the clock's steps must be the prescribed ones
// per frame, both runs' camera paths must be identical to the last bit,
// and every in-motion frame must step by the frame gap.
function expectScenarioMatches(options: {
  readonly frameCount: number
  readonly inputFrames: readonly number[]
  readonly idleEndingFrames: readonly number[]
  readonly onInput: (controls: CameraControlsImpl, frame: number) => void
}): void {
  const { clocked, stepped, prescribed } = runScenarioBothWays(options)
  const prescribedSeconds = prescribed.map((ms) => ms / 1000)
  for (let k = 0; k < prescribedSeconds.length; k += 1) {
    const dt = clocked.dtsSeconds[k]
    const expected = prescribedSeconds[k]
    if (dt === undefined || expected === undefined) {
      throw new Error(`the clock run must cover frame ${k}`)
    }
    expect(dt, `the clock's step at frame ${k} must be the prescribed one`).toBe(expected)
    // Every in-motion frame steps by the frame gap: a frame whose input
    // did not end an idle, and every frame after the motion began.
    if (k > 1 && options.inputFrames.includes(k) && !options.idleEndingFrames.includes(k)) {
      expect(dt, `the in-motion frame ${k} must step by the frame gap`).toBeCloseTo(
        FRAME_MS / 1000,
        12,
      )
    }
  }
  for (let k = 0; k < clocked.positions.length; k += 1) {
    const clockedState = clocked.positions[k]
    const steppedState = stepped.positions[k]
    if (clockedState === undefined || steppedState === undefined) {
      throw new Error(`both runs must cover frame ${k}`)
    }
    expect(clockedState.x, `frame ${k}`).toBe(steppedState.x)
    expect(clockedState.y, `frame ${k}`).toBe(steppedState.y)
    expect(clockedState.z, `frame ${k}`).toBe(steppedState.z)
  }
}

describe('a steady drag on the real controls', () => {
  it('steps the input lead once, then every frame by the frame gap, matching gap stepping exactly', () => {
    // controlstart, then rotate(dx, 0, true) 1.5 ms before every frame.
    const inputFrames = Array.from({ length: 40 }, (_, k) => k + 1)
    expectScenarioMatches({
      frameCount: 40,
      inputFrames,
      idleEndingFrames: [1],
      onInput: (controls, frame) => {
        if (frame === 1) {
          controls.dispatchEvent({ type: 'controlstart' })
        }
        controls.rotate(0.004, 0, true)
      },
    })
  })
})

describe('a wheel stream on the real controls', () => {
  it('steps the input lead once, then every frame by the frame gap, matching gap stepping exactly', () => {
    // _dollyInternal's public route: dolly(d, true) per tick.
    const inputFrames = Array.from({ length: 40 }, (_, k) => k + 1)
    expectScenarioMatches({
      frameCount: 40,
      inputFrames,
      idleEndingFrames: [1],
      onInput: (controls) => {
        controls.dolly(0.01, true)
      },
    })
  })
})

describe('a transition superseded mid-flight on the real controls', () => {
  it('keeps stepping by the frame gap through the supersede, matching gap stepping exactly', () => {
    const { plan } = staged()
    const closeUp = viewOf(plan, 'driver')
    const midView = viewOf(plan, 'shell')
    const supersedeFrame = 20
    expectScenarioMatches({
      frameCount: 40,
      inputFrames: [1, supersedeFrame],
      idleEndingFrames: [1],
      onInput: (controls, frame) => {
        // The first move leaves the staged home for the close-up; the
        // supersede retargets the running move to the mid view.
        if (frame === 1) {
          void applyView(controls, plan, closeUp, STAGE_ASPECT, true)
        }
        if (frame === supersedeFrame) {
          void applyView(controls, plan, midView, STAGE_ASPECT, true)
        }
      },
    })
  })
})
