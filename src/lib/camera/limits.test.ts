import { describe, expect, it } from 'vitest'
import {
  distanceLimitProblems,
  polarLimitProblems,
  resolvedDistanceLimits,
  resolvedPolarRange,
  type PolarRange,
} from './limits'
import { cameraLimitConfig } from './config'

describe('resolvedDistanceLimits', () => {
  it('lets each authored side win over its ratio', () => {
    const limits = resolvedDistanceLimits({ minDistance: 0.8, maxDistance: 4 }, 1.5, {
      minRatio: 0.5,
      maxRatio: 2.5,
    })

    expect(limits).toEqual({ min: 0.8, max: 4 })
  })

  it('falls back to ratios of the home distance for missing sides', () => {
    expect(resolvedDistanceLimits({}, 1.5, { minRatio: 0.5, maxRatio: 2.5 })).toEqual({
      min: 0.75,
      max: 3.75,
    })
    expect(
      resolvedDistanceLimits({ maxDistance: 5 }, 1.5, { minRatio: 0.5, maxRatio: 2.5 }),
    ).toEqual({
      min: 0.75,
      max: 5,
    })
    expect(
      resolvedDistanceLimits({ minDistance: 0.6 }, 1.5, { minRatio: 0.5, maxRatio: 2.5 }),
    ).toEqual({
      min: 0.6,
      max: 3.75,
    })
  })
})

describe('distanceLimitProblems', () => {
  const radius = 0.5

  it('passes a home strictly inside the limits that clears the model', () => {
    expect(distanceLimitProblems({ min: 0.6, max: 3 }, 1.5, radius)).toEqual([])
  })

  it('passes a home exactly at either limit', () => {
    expect(distanceLimitProblems({ min: 1.5, max: 3 }, 1.5, radius)).toEqual([])
    expect(distanceLimitProblems({ min: 0.6, max: 1.5 }, 1.5, radius)).toEqual([])
  })

  it('fails a home below the minimum, naming the values', () => {
    const problems = distanceLimitProblems({ min: 2, max: 4 }, 1.5, radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('home-within-distance-limits')
    expect(problems[0]?.message).toContain('1.5')
    expect(problems[0]?.message).toContain('2')
    expect(problems[0]?.message).toContain('4')
  })

  it('fails a home above the maximum', () => {
    const problems = distanceLimitProblems({ min: 0.6, max: 1 }, 1.5, radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('home-within-distance-limits')
  })

  it('fails a minimum at the model radius, naming both values', () => {
    const problems = distanceLimitProblems({ min: 0.5, max: 3 }, 1.5, radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('minimum-clears-the-model')
    expect(problems[0]?.message).toContain('0.5')
  })

  it('fails a minimum inside the model', () => {
    const problems = distanceLimitProblems({ min: 0.1, max: 3 }, 1.5, radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('minimum-clears-the-model')
  })
})

describe('polarLimitProblems', () => {
  const polar: PolarRange = { min: 0.25, max: 2.9 }

  it('passes a home inside the limits', () => {
    expect(polarLimitProblems(polar, 1.2)).toEqual([])
  })

  it('passes a home exactly at either limit', () => {
    expect(polarLimitProblems(polar, 0.25)).toEqual([])
    expect(polarLimitProblems(polar, 2.9)).toEqual([])
  })

  it('fails a home above the maximum, naming the values', () => {
    const problems = polarLimitProblems(polar, 3.1)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('home-within-polar-limits')
    expect(problems[0]?.message).toContain('3.1')
    expect(problems[0]?.message).toContain('2.9')
  })

  it('fails a home below the minimum', () => {
    const problems = polarLimitProblems(polar, 0.1)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('home-within-polar-limits')
  })
})

describe('resolvedPolarRange', () => {
  it('converts the configured degrees to radians the way degToRad does', () => {
    const range = resolvedPolarRange(cameraLimitConfig)
    expect(range.min).toBe((cameraLimitConfig.minPolarAngleDegrees * Math.PI) / 180)
    expect(range.max).toBe((cameraLimitConfig.maxPolarAngleDegrees * Math.PI) / 180)
  })
})
