import { describe, expect, it } from 'vitest'
import {
  distanceOfZoomPercent,
  steppedZoomPercent,
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
})

describe('zoomStepMoves', () => {
  it('moves from any distance strictly inside the limits, both ways', () => {
    expect(zoomStepMoves(2.5, range, 1, 10)).toBe(true)
    expect(zoomStepMoves(2.5, range, -1, 10)).toBe(true)
    // A step that clamps short of its full size still moves: 95 percent in
    // lands on the far end, not on itself.
    expect(zoomStepMoves(distanceOfZoomPercent(95, range), range, 1, 10)).toBe(true)
  })

  it('moves nothing at the minimum, which zoom in has reached', () => {
    expect(zoomStepMoves(range.min, range, 1, 10)).toBe(false)
    expect(zoomStepMoves(range.min, range, -1, 10)).toBe(true)
  })

  it('moves nothing at the maximum, which zoom out has reached', () => {
    expect(zoomStepMoves(range.max, range, -1, 10)).toBe(false)
    expect(zoomStepMoves(range.max, range, 1, 10)).toBe(true)
  })
})
