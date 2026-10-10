import { describe, expect, it } from 'vitest'
import {
  distanceOfZoomPercent,
  steppedZoomPercent,
  zoomLimitOf,
  zoomPercentOfDistance,
  zoomStepMoves,
} from './zoom'

const range = { min: 1, max: 4 }

describe('zoomPercentOfDistance', () => {
  it('maps the maximum distance to 0 and the minimum to 100 percent', () => {
    expect(zoomPercentOfDistance(4, range)).toBe(0)
    expect(zoomPercentOfDistance(1, range)).toBe(100)
  })

  it('maps the midpoint exactly, the rule being linear', () => {
    expect(zoomPercentOfDistance(2.5, range)).toBe(50)
  })

  it('is the exact linear map, not an approximation of it', () => {
    // 50 and 75 percent of the span are binary-exact, so no float error
    // enters: the result equals the rule's value outright.
    expect(zoomPercentOfDistance(2.5, range)).toBe(50)
    expect(zoomPercentOfDistance(1.75, range)).toBe(75)
  })
})

describe('distanceOfZoomPercent', () => {
  it('inverts zoomPercentOfDistance at every percentage', () => {
    for (const percent of [0, 5, 27.5, 50, 73, 100]) {
      const roundTrip = zoomPercentOfDistance(distanceOfZoomPercent(percent, range), range)
      expect(roundTrip).toBeCloseTo(percent, 12)
    }
  })

  it('places 0 percent at the maximum and 100 at the minimum', () => {
    expect(distanceOfZoomPercent(0, range)).toBe(4)
    expect(distanceOfZoomPercent(100, range)).toBe(1)
  })

  it.each([
    { min: 0.2, max: 0.9 },
    { min: 0.3, max: 1.2 },
  ])('preserves authored decimal endpoints exactly for $min to $max', (decimalRange) => {
    expect(distanceOfZoomPercent(0, decimalRange)).toBe(decimalRange.max)
    expect(distanceOfZoomPercent(100, decimalRange)).toBe(decimalRange.min)
  })
})

describe('steppedZoomPercent', () => {
  it('steps toward 100 when zooming in and toward 0 when zooming out', () => {
    expect(steppedZoomPercent(50, 1, 10)).toBe(60)
    expect(steppedZoomPercent(50, -1, 10)).toBe(40)
  })

  it('clamps at 0 and 100', () => {
    expect(steppedZoomPercent(95, 1, 10)).toBe(100)
    expect(steppedZoomPercent(5, -1, 10)).toBe(0)
    expect(steppedZoomPercent(100, 1, 10)).toBe(100)
    expect(steppedZoomPercent(0, -1, 10)).toBe(0)
  })

  it('moves several steps at once and clamps them like one', () => {
    expect(steppedZoomPercent(50, 3, 10)).toBe(80)
    expect(steppedZoomPercent(50, -2, 10)).toBe(30)
    expect(steppedZoomPercent(50, 7, 10)).toBe(100)
    expect(steppedZoomPercent(50, -9, 10)).toBe(0)
    expect(steppedZoomPercent(50, 0, 10)).toBe(50)
  })
})

describe('zoomLimitOf', () => {
  it('names the limit an end distance sits at exactly, and none inside', () => {
    expect(zoomLimitOf(range.min, range)).toBe('closest')
    expect(zoomLimitOf(range.max, range)).toBe('farthest')
    expect(zoomLimitOf(2.5, range)).toBeNull()
    expect(zoomLimitOf(range.min + Number.EPSILON, range)).toBeNull()
    expect(zoomLimitOf(range.max - 2 * Number.EPSILON, range)).toBeNull()
  })

  it('reads the limit a clamped step lands on', () => {
    const closest = distanceOfZoomPercent(steppedZoomPercent(95, 1, 10), range)
    const farthest = distanceOfZoomPercent(steppedZoomPercent(5, -1, 10), range)
    expect(zoomLimitOf(closest, range)).toBe('closest')
    expect(zoomLimitOf(farthest, range)).toBe('farthest')
  })
})

describe('zoomStepMoves', () => {
  it('keeps zoom in enabled immediately inside a limit even when the percentage rounds to 100', () => {
    const distance = range.min + Number.EPSILON
    expect(distance).toBeGreaterThan(range.min)
    expect(zoomPercentOfDistance(distance, range)).toBe(100)
    expect(zoomStepMoves(distance, range, 1)).toBe(true)
  })

  it('moves from any distance strictly inside the limits, both ways', () => {
    expect(zoomStepMoves(2.5, range, 1)).toBe(true)
    expect(zoomStepMoves(2.5, range, -1)).toBe(true)
    // A step that clamps short of its full size still moves: 95 percent in
    // lands on the far end, not on itself.
    expect(zoomStepMoves(distanceOfZoomPercent(95, range), range, 1)).toBe(true)
  })

  it('moves nothing at the minimum, which zoom in has reached', () => {
    expect(zoomStepMoves(range.min, range, 1)).toBe(false)
    expect(zoomStepMoves(range.min, range, -1)).toBe(true)
  })

  it('moves nothing at the maximum, which zoom out has reached', () => {
    expect(zoomStepMoves(range.max, range, -1)).toBe(false)
    expect(zoomStepMoves(range.max, range, 1)).toBe(true)
  })
})
