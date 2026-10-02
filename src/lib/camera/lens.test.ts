import { describe, expect, it } from 'vitest'
import { clipRangeOf, lensOfZoom, zoomOfLens } from './lens'
import { degrees, LENS_TABLE } from './fixtures'

// The value's own ulp: the distance to the next representable double at
// this magnitude.
function ulpOf(value: number): number {
  return 2 ** (Math.floor(Math.log2(Math.abs(value))) - 52)
}

describe('zoomOfLens', () => {
  it('maps a narrower view to a zoom above 1 and a wider one below 1', () => {
    for (const { base, view } of LENS_TABLE) {
      const zoom = zoomOfLens(degrees(base), degrees(view))
      if (view < base) {
        expect(zoom, `${view} degrees through a ${base} degree base`).toBeGreaterThan(1)
      } else {
        expect(zoom, `${view} degrees through a ${base} degree base`).toBeLessThan(1)
      }
    }
  })

  it('gives the base lens exactly the zoom 1', () => {
    // Both halves of the ratio are the same call on the same input, so the
    // division is x over x: exactly 1, not close to it.
    for (const base of [25, 11, 22.895]) {
      expect(zoomOfLens(degrees(base), degrees(base))).toBe(1)
    }
  })
})

describe('lensOfZoom', () => {
  it('inverts zoomOfLens over the table within a few ulps of the view lens', () => {
    // Each of tan and atan rounds once, so the round trip can miss the
    // view lens by a few ulps of the value itself and never more. Measured
    // across the table the gap stays within one ulp.
    const viewFovYs = LENS_TABLE.map(({ view }) => degrees(view))
    const roundTrips = LENS_TABLE.map(({ base, view }) =>
      lensOfZoom(degrees(base), zoomOfLens(degrees(base), degrees(view))),
    )
    roundTrips.forEach((roundTripped, i) => {
      const viewFovY = viewFovYs[i]
      if (viewFovY === undefined) {
        throw new Error('the table and its round trips must align')
      }
      expect(Math.abs(roundTripped - viewFovY)).toBeLessThanOrEqual(4 * ulpOf(viewFovY))
    })
  })

  it('reads the base lens back from the zoom 1 within a few ulps', () => {
    // The zoom 1 reduces the inverse to atan of tan of the half lens, two
    // roundings on the way back to the value.
    for (const base of [25, 11, 22.895]) {
      const baseFovY = degrees(base)
      expect(Math.abs(lensOfZoom(baseFovY, 1) - baseFovY)).toBeLessThanOrEqual(4 * ulpOf(baseFovY))
    }
  })
})

describe('clipRangeOf', () => {
  it('takes the smallest near and the largest far of the views', () => {
    expect(
      clipRangeOf([
        { near: 0.2, far: 50 },
        { near: 0.1, far: 30 },
        { near: 0.3, far: 40 },
      ]),
    ).toEqual({ near: 0.1, far: 50 })
  })

  it("is the one view's planes when the plan has one view", () => {
    const planes = { near: 0.05, far: 25 }
    expect(clipRangeOf([planes])).toEqual(planes)
  })

  it('fails a plan without views', () => {
    expect(() => clipRangeOf([])).toThrow(/needs at least one view/)
  })
})
