import { describe, expect, it } from 'vitest'
import { distanceOfZoomPercent, steppedZoomPercent, zoomPercentOfDistance } from './zoom'

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
