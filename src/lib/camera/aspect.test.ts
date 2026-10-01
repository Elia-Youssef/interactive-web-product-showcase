import { describe, expect, it } from 'vitest'
import { containedDistanceScale } from './aspect'

describe('containedDistanceScale', () => {
  it('scales distances up when the stage is narrower than the authored aspect', () => {
    expect(containedDistanceScale(16 / 9, 1)).toBeCloseTo(16 / 9, 15)
  })

  it('keeps the scale at 1 when the stage is wider than the authored aspect', () => {
    expect(containedDistanceScale(4 / 3, 16 / 9)).toBe(1)
  })

  it('keeps the scale at 1 when the stage matches the authored aspect', () => {
    const authored = 1.7778
    expect(containedDistanceScale(authored, authored)).toBe(1)
  })

  it('grows as the stage narrows, without bound but exactly', () => {
    const authored = 1.7778
    expect(containedDistanceScale(authored, authored / 2)).toBe(2)
    expect(containedDistanceScale(authored, authored / 10)).toBe(10)
  })

  it('keeps the scale at exactly 1 at every wider stage', () => {
    for (const stageAspect of [1.8, 2, 3.5, 10]) {
      expect(containedDistanceScale(1.7778, stageAspect)).toBe(1)
    }
  })
})
