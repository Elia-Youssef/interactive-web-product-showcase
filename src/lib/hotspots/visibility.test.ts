import { describe, expect, it } from 'vitest'
import type { MarkerExtent } from './markerBox'
import type { StageBox } from './projection'
import { isMarkerPlaceable, isMarkerVisible, isOccluded } from './visibility'

const stage: StageBox = { width: 800, height: 600 }
const extent: MarkerExtent = { markerHitPx: 44, focusOutsetPx: 5 }
const HALF = 27
const center = { x: 400, y: 300 }

describe('isOccluded', () => {
  it('is not occluded when the ray reaches the anchor untouched', () => {
    expect(isOccluded(3.5, null)).toBe(false)
  })

  it('is occluded when the nearest hit stands in front of the anchor', () => {
    expect(isOccluded(3.5, 2.5)).toBe(true)
  })

  it('is not occluded by a hit at the anchor distance: no epsilon, and the anchor clears its surface by the asset rule', () => {
    expect(isOccluded(3.5, 3.5)).toBe(false)
  })

  it('is not occluded by a hit behind the anchor, which no far-clipped ray can even return', () => {
    expect(isOccluded(3.5, 4.5)).toBe(false)
  })
})

// Each row: the projection, whether it is in front, whether an occluder
// stands before it, and whether the marker shows. A 44 px hit box with a
// 5 px ring reach keeps a 27 px half box around the projection: the rows
// put that box exactly on each stage edge, where it shows, and one pixel
// across each, where it hides, beside the camera plane and occlusion rows.
const visibilityRows: readonly (readonly [
  string,
  { x: number; y: number },
  boolean,
  boolean,
  boolean,
])[] = [
  ['in front, inside and unoccluded', center, true, false, true],
  ['behind the camera, with coordinates that would land inside', center, false, false, false],
  ['behind an occluder', center, true, true, false],
  ['with the box touching the left edge', { x: HALF, y: 300 }, true, false, true],
  ['with the box one pixel across the left edge', { x: HALF - 1, y: 300 }, true, false, false],
  ['with the box touching the right edge', { x: 800 - HALF, y: 300 }, true, false, true],
  [
    'with the box one pixel across the right edge',
    { x: 800 - HALF + 1, y: 300 },
    true,
    false,
    false,
  ],
  ['with the box touching the top edge', { x: 400, y: HALF }, true, false, true],
  ['with the box one pixel across the top edge', { x: 400, y: HALF - 1 }, true, false, false],
  ['with the box touching the bottom edge', { x: 400, y: 600 - HALF }, true, false, true],
  [
    'with the box one pixel across the bottom edge',
    { x: 400, y: 600 - HALF + 1 },
    true,
    false,
    false,
  ],
  ['with its center inside but its box across the left edge', { x: 3, y: 300 }, true, false, false],
]

describe('isMarkerVisible', () => {
  for (const [name, point, inFront, occluded, shows] of visibilityRows) {
    it(`${shows ? 'shows' : 'hides'} ${name}`, () => {
      expect(isMarkerVisible({ ...point, inFront }, stage, extent, occluded)).toBe(shows)
    })
  }
})

describe('isMarkerPlaceable', () => {
  it('ignores occlusion: it is the in front and inside half of the rule', () => {
    expect(isMarkerPlaceable({ ...center, inFront: true }, stage, extent)).toBe(true)
    expect(isMarkerPlaceable({ x: HALF - 1, y: 300, inFront: true }, stage, extent)).toBe(false)
    expect(isMarkerPlaceable({ ...center, inFront: false }, stage, extent)).toBe(false)
  })
})
