// The one camera contract assembly, over a table: every view's geometry,
// the home view and a close-up inside and outside each limit, the minimum
// inside the model, and the fixed problem order. The runtime plan reports
// these problems as its broken build; the validate step reports them as
// violations. The exact rule wording is part of the contract.
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

// The problems a check reports: none when the contract holds.
function problemsOf(views: readonly NamedCameraRay[], authored: AuthoredDistanceLimits = {}) {
  const result = check(views, authored)
  return result.kind === 'broken' ? result.problems : []
}

const POLAR_RANGE_TEXT = `[${(15 * Math.PI) / 180}, ${(165 * Math.PI) / 180}]`

describe('cameraContractProblems', () => {
  it('returns no problems and the resolved limits when every view holds the contract', () => {
    // The fallback range at the home distance 4, and the configured polar
    // range: the close-up sets none of it.
    expect(check([FRONT_HOME, { id: 'driver', ray: frontRay(2.5) }])).toEqual({
      kind: 'holds',
      distanceRange: { min: 2, max: 10 },
      polarRange: { min: (15 * Math.PI) / 180, max: (165 * Math.PI) / 180 },
    })
  })

  it('keeps the home inside the fallback distance ratios of the config', () => {
    // The fallback range is derived from the home distance, so it always
    // holds it; the fallback minimum at a close home still has to clear
    // the model.
    const result = problemsOf([{ id: 'home', ray: frontRay(1.5) }])
    expect(result).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 0.75 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the authored distance limits by its view', () => {
    const result = problemsOf([FRONT_HOME], { minDistance: 5, maxDistance: 8 })
    expect(result).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_home distance 4 lies outside the distance limits [5, 8]',
      },
    ])
  })

  it('reports a close-up below the fallback minimum, which the home alone sets', () => {
    // The close-up at 1.5 sits below the home's fallback minimum of 2: the
    // controls would clamp it back out, so it fails by its own view.
    const result = problemsOf([FRONT_HOME, { id: 'driver', ray: frontRay(1.5) }])
    expect(result).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_driver distance 1.5 lies outside the distance limits [2, 10]',
      },
    ])
  })

  it('passes a close-up an authored minimum brings in reach, and fails it just above', () => {
    const closeUp: NamedCameraRay = { id: 'driver', ray: frontRay(1.5) }
    expect(problemsOf([FRONT_HOME, closeUp], { minDistance: 1.5 })).toEqual([])
    expect(
      problemsOf([FRONT_HOME, closeUp], { minDistance: 1.5 * (1 + 1e-6) }).map(
        (problem) => problem.rule,
      ),
    ).toEqual(['view-within-distance-limits'])
  })

  it('reports every view outside the limits, in view order', () => {
    const result = problemsOf([
      { id: 'driver', ray: frontRay(1) },
      FRONT_HOME,
      { id: 'knob', ray: frontRay(11) },
    ])
    expect(result.map((problem) => problem.message)).toEqual([
      'the CAM_driver distance 1 lies outside the distance limits [2, 10]',
      'the CAM_knob distance 11 lies outside the distance limits [2, 10]',
    ])
  })

  it('reports an authored minimum that does not clear the model radius', () => {
    const result = problemsOf([FRONT_HOME], { minDistance: 1 })
    expect(result).toEqual([
      {
        rule: 'minimum-clears-the-model',
        message: 'the minimum distance 1 does not exceed the model radius 1',
      },
    ])
  })

  it('reports a home outside the polar limits by its view', () => {
    const result = problemsOf([{ id: 'home', ray: overheadRay(4) }])
    expect(result).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_home polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports a close-up outside the polar limits by its view', () => {
    const result = problemsOf([FRONT_HOME, { id: 'knob', ray: overheadRay(3) }])
    expect(result).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_knob polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports the distance problems before the polar problems', () => {
    const result = problemsOf([{ id: 'home', ray: overheadRay(4) }], { minDistance: 1 })
    expect(result.map((problem) => problem.rule)).toEqual([
      'minimum-clears-the-model',
      'view-within-polar-limits',
    ])
  })

  it('fails loudly when the views hold no home view', () => {
    expect(() => check([{ id: 'driver', ray: frontRay(4) }])).toThrow(
      "internal error: the contract views hold no home view 'home'",
    )
  })

  it('reports a broken view by its geometry and runs no limit rule on a broken home', () => {
    // The home's view ray passes the model center at a right angle, so it
    // has no orbit distance to derive the fallback limits from: the
    // authored minimum inside the model is not reported, and no limit
    // message carries a value the broken home could not give.
    const sideways: AuthoredCameraRay = { position: [0, 0, 4], forward: [1, 0, 0], fovY: 0.5 }
    const result = check(
      [
        { id: 'home', ray: sideways },
        { id: 'driver', ray: { ...frontRay(4), fovY: 0 } },
      ],
      { minDistance: 1 },
    )
    expect(result).toEqual({
      kind: 'broken',
      problems: [
        {
          rule: 'view-orbit-distance',
          message:
            'the camera CAM_home orbits its own position: its view ray passes the model center at a right angle',
        },
        {
          rule: 'view-field-of-view',
          message: `the camera CAM_driver has a field of view of 0 rad, outside the open range (0, ${Math.PI})`,
        },
      ],
    })
  })

  it('checks every view, and holds a broken close-up to its geometry alone', () => {
    // A close-up with no orbit has no distance or polar angle to hold to
    // the limits, so only its geometry problem names it, while the sound
    // views still answer to every limit rule.
    const result = problemsOf([
      FRONT_HOME,
      { id: 'driver', ray: { ...frontRay(4), position: [0, 0, Number.NaN] } },
      { id: 'knob', ray: frontRay(11) },
    ])
    expect(result).toEqual([
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite position' },
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_knob distance 11 lies outside the distance limits [2, 10]',
      },
    ])
  })
})
