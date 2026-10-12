import { describe, expect, it } from 'vitest'
import {
  distanceLimitProblems,
  polarLimitProblems,
  reachLimitProblems,
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
  const range: { min: number; max: number } = { min: 0.6, max: 3 }

  // The orbit distance of one named view, at the authored aspect.
  const view = (id: string, distance: number): ViewOrbit => ({
    id,
    target: [0, 0, 0],
    distance,
    polar: 1.2,
    reach: 0.5,
    pivot: 'the model center',
  })

  it('passes a home and a close-up strictly inside the limits', () => {
    const problems = distanceLimitProblems(range, [view('home', 1.5), view('driver', 0.7)])

    expect(problems).toEqual([])
  })

  it('passes a view exactly at either limit', () => {
    const problems = distanceLimitProblems(range, [view('home', 0.6), view('driver', 3)])

    expect(problems).toEqual([])
  })

  it('fails a close-up below the minimum, naming the view and the values', () => {
    const problems = distanceLimitProblems({ min: 0.53, max: 3 }, [
      view('home', 1.06),
      view('driver', 0.363),
    ])

    expect(problems).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_driver distance 0.363 lies outside the distance limits [0.53, 3]',
      },
    ])
  })

  it('fails a close-up beyond the maximum, naming the view', () => {
    const problems = distanceLimitProblems(range, [view('home', 1.5), view('driver', 3.1)])

    expect(problems).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_driver distance 3.1 lies outside the distance limits [0.6, 3]',
      },
    ])
  })

  it('fails the home view by the same rule when it sits outside the limits', () => {
    const problems = distanceLimitProblems(range, [view('home', 5)])

    expect(problems.map((problem) => problem.message)).toEqual([
      'the CAM_home distance 5 lies outside the distance limits [0.6, 3]',
    ])
  })

  it('reports every view outside the limits, not the first one alone', () => {
    const problems = distanceLimitProblems(range, [view('driver', 0.1), view('knob', 9)])

    expect(problems).toHaveLength(2)
  })
})

describe('polarLimitProblems', () => {
  const polar: PolarRange = { min: 0.25, max: 2.9 }

  const view = (id: string, polarAngle: number): ViewOrbit => ({
    id,
    target: [0, 0, 0],
    distance: 1.5,
    polar: polarAngle,
    reach: 0.5,
    pivot: 'the model center',
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

describe('reachLimitProblems', () => {
  // One view's orbit with its reach and the pivot its target came from.
  const view = (
    id: string,
    reach: number,
    pivot: string,
    target: readonly [number, number, number] = [0, 0, 0],
  ): ViewOrbit => ({
    id,
    target,
    distance: 1.5,
    polar: 1.2,
    reach,
    pivot,
  })
  const home = (reach: number) => view('home', reach, 'the model center')
  const closeUp = (reach: number) => view('driver', reach, 'the HS_driver anchor')

  // Every view answers to the one rule, the home view included, and the
  // minimum must exceed the reach: a minimum at the reach puts the camera
  // on the model.
  const rows: readonly {
    readonly name: string
    readonly min: number
    readonly views: readonly ViewOrbit[]
    readonly failing: readonly string[]
  }[] = [
    {
      name: 'a minimum beyond every reach passes',
      min: 0.8,
      views: [home(0.5), closeUp(0.7)],
      failing: [],
    },
    {
      name: 'a home whose reach the minimum equals fails',
      min: 0.5,
      views: [home(0.5)],
      failing: ['home'],
    },
    {
      name: 'a home whose reach passes the minimum fails',
      min: 0.4,
      views: [home(0.5)],
      failing: ['home'],
    },
    {
      name: 'a close-up whose reach the minimum equals fails',
      min: 0.7,
      views: [home(0.5), closeUp(0.7)],
      failing: ['driver'],
    },
    {
      name: 'a close-up just inside the minimum passes',
      min: 0.7,
      views: [home(0.5), closeUp(0.7 - 1e-9)],
      failing: [],
    },
    {
      name: 'every view past the minimum fails, in view order',
      min: 0.3,
      views: [home(0.5), closeUp(0.7)],
      failing: ['home', 'driver'],
    },
  ]

  it.each(rows)('$name', ({ min, views, failing }) => {
    const problems = reachLimitProblems({ min, max: 5 }, views, 'sample-one')
    expect(problems.map((problem) => problem.rule)).toEqual(
      failing.map(() => 'minimum-clears-reach'),
    )
    expect(problems.map((problem) => problem.message)).toEqual(
      failing.map((id) => {
        const failed = views.find((candidate) => candidate.id === id)
        if (failed === undefined) {
          throw new Error(`the row names a view ${id} it does not carry`)
        }
        return `the sample-one CAM_${id} minimum distance ${min} does not exceed the model reach ${failed.reach} from its orbit target, projected from ${failed.pivot}`
      }),
    )
  })

  it('names the product, the view, the pivot and both numbers', () => {
    expect(reachLimitProblems({ min: 0.6, max: 3 }, [closeUp(0.85)], 'sample-two')).toEqual([
      {
        rule: 'minimum-clears-reach',
        message:
          'the sample-two CAM_driver minimum distance 0.6 does not exceed the model reach 0.85 from its orbit target, projected from the HS_driver anchor',
      },
    ])
  })
})
