// The one camera contract assembly, over a table: the home view and a
// close-up inside and outside each limit, the minimum inside the model,
// and the fixed problem order. The runtime plan throws these problems as a
// CameraLimitsError; the validate step reports them as violations. The
// exact rule wording is part of the contract.
import { describe, expect, it } from 'vitest'
import { cameraContractProblems } from './contract'
import { cameraLimitConfig } from './config'
import type { AuthoredDistanceLimits } from './limits'
import type { AuthoredCameraRay, NamedCameraRay } from './view'

// A frame the rules can read: the model centered on the origin with a
// radius of 1.
const FRAME = { center: [0, 0, 0] as const, radius: 1 }

// A camera on the +Z axis at the given distance, looking at the model: the
// orbit angles are the plain distance and the level polar angle of 90
// degrees.
function frontRay(distance: number): AuthoredCameraRay {
  return { position: [0, 0, distance], forward: [0, 0, -1], fovY: 0.5 }
}

// A camera straight above the model at the given height, looking down: the
// polar angle 0, below the configured minimum.
function overheadRay(height: number): AuthoredCameraRay {
  return { position: [0, height, 0], forward: [0, -1, 0], fovY: 0.5 }
}

const FRONT_HOME: NamedCameraRay = { id: 'home', ray: frontRay(4) }

function check(views: readonly NamedCameraRay[], authored: AuthoredDistanceLimits = {}) {
  return cameraContractProblems({
    views,
    homeId: 'home',
    frame: FRAME,
    authoredDistanceLimits: authored,
    limits: cameraLimitConfig,
  })
}

const POLAR_RANGE_TEXT = `[${(15 * Math.PI) / 180}, ${(165 * Math.PI) / 180}]`

describe('cameraContractProblems', () => {
  it('returns no problems and the resolved limits when every view holds the contract', () => {
    const result = check([FRONT_HOME, { id: 'driver', ray: frontRay(2.5) }])
    expect(result.problems).toEqual([])
    // The fallback range at the home distance 4, and the configured polar
    // range: the close-up sets none of it.
    expect(result.distanceRange).toEqual({ min: 2, max: 10 })
    expect(result.polarRange).toEqual({
      min: (15 * Math.PI) / 180,
      max: (165 * Math.PI) / 180,
    })
  })

  it('keeps the home inside the fallback distance ratios of the config', () => {
    // The fallback range is derived from the home distance, so it always
    // holds it; the fallback minimum at a close home still has to clear
    // the model.
    const result = check([{ id: 'home', ray: frontRay(1.5) }])
    expect(result.problems).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 0.75 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the authored distance limits by its view', () => {
    const result = check([FRONT_HOME], { minDistance: 5, maxDistance: 8 })
    expect(result.problems).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_home distance 4 lies outside the distance limits [5, 8]',
      },
    ])
  })

  it('reports a close-up below the fallback minimum, which the home alone sets', () => {
    // The close-up at 1.5 sits below the home's fallback minimum of 2: the
    // controls would clamp it back out, so it fails by its own view.
    const result = check([FRONT_HOME, { id: 'driver', ray: frontRay(1.5) }])
    expect(result.problems).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_driver distance 1.5 lies outside the distance limits [2, 10]',
      },
    ])
  })

  it('passes a close-up an authored minimum brings in reach, and fails it just above', () => {
    const closeUp: NamedCameraRay = { id: 'driver', ray: frontRay(1.5) }
    expect(check([FRONT_HOME, closeUp], { minDistance: 1.5 }).problems).toEqual([])
    expect(
      check([FRONT_HOME, closeUp], { minDistance: 1.5 * (1 + 1e-6) }).problems.map(
        (problem) => problem.rule,
      ),
    ).toEqual(['view-within-distance-limits'])
  })

  it('reports every view outside the limits, in view order', () => {
    const result = check([
      { id: 'driver', ray: frontRay(1) },
      FRONT_HOME,
      { id: 'knob', ray: frontRay(11) },
    ])
    expect(result.problems.map((problem) => problem.message)).toEqual([
      'the CAM_driver distance 1 lies outside the distance limits [2, 10]',
      'the CAM_knob distance 11 lies outside the distance limits [2, 10]',
    ])
  })

  it('reports an authored minimum that does not clear the model radius', () => {
    const result = check([FRONT_HOME], { minDistance: 1 })
    expect(result.problems).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 1 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the polar limits by its view', () => {
    const result = check([{ id: 'home', ray: overheadRay(4) }])
    expect(result.problems).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_home polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports a close-up outside the polar limits by its view', () => {
    const result = check([FRONT_HOME, { id: 'knob', ray: overheadRay(3) }])
    expect(result.problems).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_knob polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports the distance problems before the polar problems', () => {
    const result = check([{ id: 'home', ray: overheadRay(4) }], { minDistance: 1 })
    expect(result.problems.map((problem) => problem.rule)).toEqual([
      'minimum-clears-the-model',
      'view-within-polar-limits',
    ])
  })

  it('fails loudly when the views hold no home view', () => {
    expect(() => check([{ id: 'driver', ray: frontRay(4) }])).toThrow(
      "internal error: the contract views hold no home view 'home'",
    )
  })
})
