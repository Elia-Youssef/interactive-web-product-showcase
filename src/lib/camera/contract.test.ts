// The one camera contract assembly, over a table: the home view inside and
// outside each limit, the minimum inside the model, and the fixed problem
// order. The runtime plan reports these problems as its broken build; the
// validate step reports them as violations. The exact rule wording is
// part of the contract.
import { describe, expect, it } from 'vitest'
import { cameraContractProblems } from './contract'
import { cameraLimitConfig } from './config'

// A frame the rules can read: the model centered on the origin with a
// radius of 1.
const FRAME = { center: [0, 0, 0] as const, radius: 1 }

// The home view at distance 4 straight in front of the model, looking at
// it: the orbit angles are the plain distance 4 and the level polar angle
// of 90 degrees.
const FRONT_HOME = {
  position: [0, 0, 4] as const,
  forward: [0, 0, -1] as const,
  fovY: 0.5,
}

describe('cameraContractProblems', () => {
  it('returns no problems and the resolved limits when the home view holds the contract', () => {
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: FRONT_HOME }],
      home: FRONT_HOME,
      frame: FRAME,
      authoredDistanceLimits: {},
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([])
    // The fallback range at distance 4, and the configured polar range.
    expect(check.distanceRange).toEqual({ min: 2, max: 10 })
    expect(check.polarRange).toEqual({
      min: (15 * Math.PI) / 180,
      max: (165 * Math.PI) / 180,
    })
  })

  it('keeps the home inside the fallback distance ratios of the config', () => {
    // The fallback range is derived from the home distance, so it always
    // holds it; the fallback minimum at a close home still has to clear
    // the model.
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: { position: [0, 0, 1.5], forward: [0, 0, -1], fovY: 0.5 } }],
      home: { position: [0, 0, 1.5], forward: [0, 0, -1], fovY: 0.5 },
      frame: FRAME,
      authoredDistanceLimits: {},
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 0.75 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the authored distance limits', () => {
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: FRONT_HOME }],
      home: FRONT_HOME,
      frame: FRAME,
      authoredDistanceLimits: { minDistance: 5, maxDistance: 8 },
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([
      {
        rule: 'home-within-distance-limits',
        message: 'the home distance 4 lies outside the distance limits [5, 8]',
      },
    ])
  })

  it('reports an authored minimum that does not clear the model radius', () => {
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: FRONT_HOME }],
      home: FRONT_HOME,
      frame: FRAME,
      authoredDistanceLimits: { minDistance: 1 },
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 1 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the polar limits', () => {
    // Straight above the model, looking down: the polar angle 0 is below
    // the configured minimum.
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: { position: [0, 4, 0], forward: [0, -1, 0], fovY: 0.5 } }],
      home: { position: [0, 4, 0], forward: [0, -1, 0], fovY: 0.5 },
      frame: FRAME,
      authoredDistanceLimits: {},
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([
      {
        rule: 'home-within-polar-limits',
        message: `the home polar angle 0 lies outside the polar limits [${
          (15 * Math.PI) / 180
        }, ${(165 * Math.PI) / 180}]`,
      },
    ])
  })

  it('reports the distance problems before the polar problem', () => {
    const check = cameraContractProblems({
      views: [{ id: 'home', ray: { position: [0, 4, 0], forward: [0, -1, 0], fovY: 0.5 } }],
      home: { position: [0, 4, 0], forward: [0, -1, 0], fovY: 0.5 },
      frame: FRAME,
      authoredDistanceLimits: { minDistance: 1 },
      limits: cameraLimitConfig,
    })
    expect(check.problems.map((problem) => problem.rule)).toEqual([
      'minimum-clears-the-model',
      'home-within-polar-limits',
    ])
  })

  it('reports a broken view by its geometry and runs no limit rule on a broken home', () => {
    const sideways = { position: [0, 0, 4] as const, forward: [1, 0, 0] as const, fovY: 0.5 }
    const check = cameraContractProblems({
      views: [
        { id: 'home', ray: sideways },
        { id: 'driver', ray: { ...FRONT_HOME, fovY: 0 } },
      ],
      home: sideways,
      frame: FRAME,
      authoredDistanceLimits: { minDistance: 1 },
      limits: cameraLimitConfig,
    })
    expect(check.problems.map((problem) => problem.rule)).toEqual([
      'view-orbit-distance',
      'view-field-of-view',
    ])
  })

  it('checks every view, a broken close-up beside a sound home included', () => {
    const check = cameraContractProblems({
      views: [
        { id: 'home', ray: FRONT_HOME },
        { id: 'driver', ray: { ...FRONT_HOME, position: [0, 0, Number.NaN] } },
      ],
      home: FRONT_HOME,
      frame: FRAME,
      authoredDistanceLimits: {},
      limits: cameraLimitConfig,
    })
    expect(check.problems).toEqual([
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite position' },
    ])
  })
})
