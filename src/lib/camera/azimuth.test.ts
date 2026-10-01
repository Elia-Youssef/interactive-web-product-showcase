import { describe, expect, it } from 'vitest'
import { normalizedAzimuthDegrees } from './azimuth'

describe('normalizedAzimuthDegrees', () => {
  it('reads 0 degrees in front of the product on +Z', () => {
    expect(normalizedAzimuthDegrees(0)).toBe(0)
  })

  it('keeps an angle inside one turn as the degrees of the radians', () => {
    expect(normalizedAzimuthDegrees(Math.PI / 2)).toBeCloseTo(90, 12)
    expect(normalizedAzimuthDegrees(Math.PI)).toBeCloseTo(180, 12)
  })

  it('normalizes an accumulated turn: 725 degrees reads 5', () => {
    expect(normalizedAzimuthDegrees((725 * Math.PI) / 180)).toBeCloseTo(5, 9)
  })

  it('normalizes several accumulated turns', () => {
    expect(normalizedAzimuthDegrees((1080 * Math.PI) / 180)).toBeCloseTo(0, 9)
    expect(normalizedAzimuthDegrees((1445 * Math.PI) / 180)).toBeCloseTo(5, 9)
  })

  it('normalizes a negative azimuth into [0, 360)', () => {
    expect(normalizedAzimuthDegrees((-10 * Math.PI) / 180)).toBeCloseTo(350, 9)
    expect(normalizedAzimuthDegrees((-90 * Math.PI) / 180)).toBeCloseTo(270, 9)
    expect(normalizedAzimuthDegrees((-725 * Math.PI) / 180)).toBeCloseTo(355, 9)
  })

  it('stays inside [0, 360) across a full sweep', () => {
    for (let turn = -3; turn <= 3; turn += 0.25) {
      const degrees = normalizedAzimuthDegrees(turn * Math.PI)
      expect(degrees).toBeGreaterThanOrEqual(0)
      expect(degrees).toBeLessThan(360)
    }
  })
})
