import { describe, expect, it } from 'vitest'
import {
  distanceLimitProblems,
  polarLimitProblems,
  resolvedDistanceLimits,
  resolvedPolarRange,
  type PolarRange,
  type ViewOrbit,
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
  const range: { min: number; max: number } = { min: 0.6, max: 3 }

  // The orbit distance of one named view, at the authored aspect.
  const view = (id: string, distance: number): ViewOrbit => ({ id, distance, polar: 1.2 })

  it('passes a home and a close-up strictly inside the limits that clear the model', () => {
    const problems = distanceLimitProblems(range, [view('home', 1.5), view('driver', 0.7)], radius)

    expect(problems).toEqual([])
  })

  it('passes a view exactly at either limit', () => {
    const problems = distanceLimitProblems(range, [view('home', 0.6), view('driver', 3)], radius)

    expect(problems).toEqual([])
  })

  it('fails a close-up below the minimum, naming the view and the values', () => {
    const problems = distanceLimitProblems(
      { min: 0.53, max: 3 },
      [view('home', 1.06), view('driver', 0.363)],
      radius,
    )

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('view-within-distance-limits')
    expect(problems[0]?.message).toContain('CAM_driver')
    expect(problems[0]?.message).toContain('0.363')
    expect(problems[0]?.message).toContain('0.53')
  })

  it('fails a close-up beyond the maximum, naming the view', () => {
    const problems = distanceLimitProblems(range, [view('home', 1.5), view('driver', 3.1)], radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('view-within-distance-limits')
    expect(problems[0]?.message).toContain('CAM_driver')
  })

  it('fails the home view by the same rule when it sits outside the limits', () => {
    const problems = distanceLimitProblems(range, [view('home', 5)], radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('view-within-distance-limits')
    expect(problems[0]?.message).toContain('CAM_home')
  })

  it('reports every view outside the limits, not the first one alone', () => {
    const problems = distanceLimitProblems(range, [view('driver', 0.1), view('knob', 9)], radius)

    expect(problems).toHaveLength(2)
  })

  it('fails a minimum at the model radius, naming both values', () => {
    const problems = distanceLimitProblems({ min: 0.5, max: 3 }, [view('home', 1.5)], radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('minimum-clears-the-model')
    expect(problems[0]?.message).toContain('0.5')
  })

  it('fails a minimum inside the model', () => {
    const problems = distanceLimitProblems({ min: 0.1, max: 3 }, [view('home', 1.5)], radius)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('minimum-clears-the-model')
  })
})

describe('polarLimitProblems', () => {
  const polar: PolarRange = { min: 0.25, max: 2.9 }

  const view = (id: string, polarAngle: number): ViewOrbit => ({
    id,
    distance: 1.5,
    polar: polarAngle,
  })

  it('passes a home and a close-up inside the limits', () => {
    const problems = polarLimitProblems(polar, [view('home', 1.2), view('driver', 0.6)])

    expect(problems).toEqual([])
  })

  it('passes a view exactly at either limit', () => {
    const problems = polarLimitProblems(polar, [view('home', 0.25), view('driver', 2.9)])

    expect(problems).toEqual([])
  })

  it('fails a close-up outside the polar range, naming the view and the values', () => {
    const problems = polarLimitProblems(polar, [view('home', 1.2), view('driver', 3.1)])

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('view-within-polar-limits')
    expect(problems[0]?.message).toContain('CAM_driver')
    expect(problems[0]?.message).toContain('3.1')
    expect(problems[0]?.message).toContain('2.9')
  })

  it('fails a view below the minimum, naming the view', () => {
    const problems = polarLimitProblems(polar, [view('home', 0.1)])

    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('view-within-polar-limits')
    expect(problems[0]?.message).toContain('CAM_home')
  })
})

describe('resolvedPolarRange', () => {
  it('converts the configured degrees to radians the way degToRad does', () => {
    const range = resolvedPolarRange(cameraLimitConfig)
    expect(range.min).toBe((cameraLimitConfig.minPolarAngleDegrees * Math.PI) / 180)
    expect(range.max).toBe((cameraLimitConfig.maxPolarAngleDegrees * Math.PI) / 180)
  })
})
