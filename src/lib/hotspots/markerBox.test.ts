import { describe, expect, it } from 'vitest'
import { isKeepOutInsideStage, markerKeepOut, type MarkerExtent } from './markerBox'
import type { StageBox } from './projection'

// A 44 px hit box and a ring reaching 5 px outside it: the keep-out box is
// 54 px square, 27 px from the marker's center to each side.
const extent: MarkerExtent = { markerHitPx: 44, focusOutsetPx: 5 }
const stage: StageBox = { width: 800, height: 600 }
const HALF = 27

describe('markerKeepOut', () => {
  it('grows the hit box by the ring reach on every side', () => {
    expect(markerKeepOut({ x: 400, y: 300 }, extent)).toEqual({
      left: 373,
      top: 273,
      right: 427,
      bottom: 327,
    })
  })
})

// Each row: the marker's placement and whether its keep-out box fits. The
// rows walk each of the four edges: the box exactly touching it fits, the
// box one pixel across it does not.
const fitRows: readonly (readonly [string, { x: number; y: number }, boolean])[] = [
  ['the stage center', { x: 400, y: 300 }, true],
  ['the box touching the left edge', { x: HALF, y: 300 }, true],
  ['the box one pixel across the left edge', { x: HALF - 1, y: 300 }, false],
  ['the box touching the right edge', { x: 800 - HALF, y: 300 }, true],
  ['the box one pixel across the right edge', { x: 800 - HALF + 1, y: 300 }, false],
  ['the box touching the top edge', { x: 400, y: HALF }, true],
  ['the box one pixel across the top edge', { x: 400, y: HALF - 1 }, false],
  ['the box touching the bottom edge', { x: 400, y: 600 - HALF }, true],
  ['the box one pixel across the bottom edge', { x: 400, y: 600 - HALF + 1 }, false],
  ['the center on the edge itself', { x: 0, y: 300 }, false],
]

describe('isKeepOutInsideStage', () => {
  for (const [name, marker, fits] of fitRows) {
    it(`${fits ? 'fits' : 'does not fit'} with ${name}`, () => {
      expect(isKeepOutInsideStage(marker, stage, extent)).toBe(fits)
    })
  }
})
