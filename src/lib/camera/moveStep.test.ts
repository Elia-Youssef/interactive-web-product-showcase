import { describe, expect, it } from 'vitest'
import { moveStepMs } from './moveStep'

// The step rule over the table of frame, move and motion timings.
// Timestamps are performance.now style milliseconds; the frame gap is a
// steady display's 16.7, and an input step lands 1.5 ms before its frame,
// the alignment browsers give continuous input.

describe('moveStepMs', () => {
  it('steps a steady stream of input-driven frames by the frame gap', () => {
    // A drag or wheel spin: the controls are in motion, an input step
    // lands 1.5 ms before every frame, and every step is still the frame
    // gap, never the 1.5 ms since the step.
    expect(moveStepMs(2001.5, 1985, 2000, true)).toBeCloseTo(16.5, 9)
    expect(moveStepMs(2018, 2001.5, 2016.5, true)).toBeCloseTo(16.5, 9)
  })

  it('steps a frame after a superseding move while in motion by the frame gap', () => {
    // A programmatic move supersedes a running one: its start must not
    // restart the clock, because the time since the previous frame was
    // motion time.
    expect(moveStepMs(2033.4, 2016.7, 2030, true)).toBeCloseTo(16.7, 9)
  })

  it('steps a move that starts after the controls slept by the move age', () => {
    // The stage idled, the move started at 4990, the frame came at 5000:
    // the step is the 10 ms since the move started, never the 4000 ms
    // since the last frame.
    expect(moveStepMs(5000, 1000, 4990, false)).toBe(10)
  })

  it('steps the frame after the controls fell asleep and a move started, from the move start', () => {
    // The controls fall asleep on a frame, and a move starts before the
    // next one: asleep, the step anchors at the move start, the short age
    // of a move nothing was integrating.
    expect(moveStepMs(2016.7, 2000, 2010, false)).toBeCloseTo(6.7, 9)
  })

  it('keeps the frame gap for frames that run while the controls sleep', () => {
    // A resize or another scene reason renders frames while the controls
    // are asleep: every step is the frame gap, and a move that then starts
    // anchors the next step at its own start.
    expect(moveStepMs(2016.7, 2000, null, false)).toBeCloseTo(16.7, 9)
    expect(moveStepMs(2033.4, 2016.7, null, false)).toBeCloseTo(16.7, 9)
    expect(moveStepMs(2050.1, 2033.4, 2048.4, false)).toBeCloseTo(1.7, 9)
  })

  it('steps a first moving step short after a press that moved nothing', () => {
    // A pointer press (controlstart) with no movement yet, then the first
    // pointermove 1.5 ms before the next frame: nothing was integrating
    // before it, so that first moving step is its 1.5 ms.
    expect(moveStepMs(2000, 1985, 1990, false)).toBeCloseTo(10, 9)
    expect(moveStepMs(2016.7, 2000, 2015.2, false)).toBeCloseTo(1.5, 9)
    // And from the next frame on the stream steps by the gap.
    expect(moveStepMs(2033.4, 2016.7, 2015.2, true)).toBeCloseTo(16.7, 9)
  })

  it('steps zero on the first frame before any move', () => {
    expect(moveStepMs(100, null, null, false)).toBe(0)
    expect(moveStepMs(100, null, null, true)).toBe(0)
  })

  it('steps a first frame that follows a move already begun from the move start', () => {
    expect(moveStepMs(5000, null, 4990, false)).toBe(10)
  })

  it('steps a frame with no move by the gap to the previous frame', () => {
    // A frame the stage owes for a reason other than a camera move, before
    // any move: the step is the frame gap, which eases nothing.
    expect(moveStepMs(5000, 4990, null, false)).toBe(10)
  })
})
