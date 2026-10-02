import { describe, expect, it } from 'vitest'
import type { StageBox } from './projection'
import { isOccluded, isMarkerVisible } from './visibility'

const stage: StageBox = { width: 800, height: 600 }
const center = { x: 400, y: 300, inFront: true }

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

describe('isMarkerVisible', () => {
  it('shows in front, inside and unoccluded', () => {
    expect(isMarkerVisible(center, stage, false)).toBe(true)
  })

  it('hides behind the camera even when the coordinates would land inside', () => {
    expect(isMarkerVisible({ ...center, inFront: false }, stage, false)).toBe(false)
  })

  it('hides outside the box on any side', () => {
    expect(isMarkerVisible({ ...center, x: -1 }, stage, false)).toBe(false)
    expect(isMarkerVisible({ ...center, x: 801 }, stage, false)).toBe(false)
    expect(isMarkerVisible({ ...center, y: -1 }, stage, false)).toBe(false)
    expect(isMarkerVisible({ ...center, y: 601 }, stage, false)).toBe(false)
  })

  it('shows exactly on the box edges', () => {
    expect(isMarkerVisible({ ...center, x: 0 }, stage, false)).toBe(true)
    expect(isMarkerVisible({ ...center, x: 800 }, stage, false)).toBe(true)
    expect(isMarkerVisible({ ...center, y: 0 }, stage, false)).toBe(true)
    expect(isMarkerVisible({ ...center, y: 600 }, stage, false)).toBe(true)
  })

  it('hides when an occluder stands between the camera and the anchor', () => {
    expect(isMarkerVisible(center, stage, true)).toBe(false)
  })
})
