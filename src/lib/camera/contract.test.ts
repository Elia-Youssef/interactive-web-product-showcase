// The one camera contract assembly, over a table: every view's geometry,
// the home view and a close-up inside and outside each limit, each view's
// reach against the minimum, the home view's reach at the explode's last
// key, the close-up pivot, and the fixed problem order. The runtime plan
// reports these problems as its broken build; the validate step reports
// them as violations. The exact rule wording is part of the contract.
import { describe, expect, it } from 'vitest'
import { cameraContractProblems } from './contract'
import { cameraLimitConfig } from './config'
import type { ModelBounds } from './frame'
import type { AuthoredDistanceLimits } from './limits'
import type { AuthoredCameraRay, NamedCameraRay, Vec3, ViewPivot } from './view'

// A model the rules can read: a rod one unit long either side of the
// origin along X, so the reach from a point on the Z axis at z is
// sqrt(1 + z^2), and 1 from the center itself.
const BOUNDS: ModelBounds = { min: [-1, 0, 0], max: [1, 0, 0] }

const MODEL_CENTER: ViewPivot = { point: [0, 0, 0], subject: 'the model center' }

function anchorOf(id: string, point: Vec3): ViewPivot {
  return { point, subject: `the HS_${id} anchor` }
}

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

function view(id: string, ray: AuthoredCameraRay, pivot: ViewPivot = MODEL_CENTER): NamedCameraRay {
  return { id, ray, pivot }
}

const FRONT_HOME = view('home', frontRay(4))

function check(
  views: readonly NamedCameraRay[],
  authored: AuthoredDistanceLimits = {},
  explodedBounds: ModelBounds | null = null,
) {
  return cameraContractProblems({
    product: 'sample-one',
    views,
    homeId: 'home',
    bounds: BOUNDS,
    explodedBounds,
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
    expect(check([FRONT_HOME, view('driver', frontRay(2.5))])).toEqual({
      kind: 'holds',
      distanceRange: { min: 2, max: 10 },
      polarRange: { min: (15 * Math.PI) / 180, max: (165 * Math.PI) / 180 },
    })
  })

  it('holds the fallback minimum of a close home to the model reach from its target', () => {
    // The fallback range is derived from the home distance, so it always
    // holds it; the fallback minimum of 0.75 at a close home still has to
    // exceed the model's reach of 1 from the home target.
    expect(problemsOf([view('home', frontRay(1.5))])).toEqual([
      {
        rule: 'minimum-clears-reach',
        message:
          'the sample-one CAM_home minimum distance 0.75 does not exceed the model reach 1 from its orbit target, projected from the model center',
      },
    ])
  })

  it('reports a home outside the authored distance limits by its view', () => {
    expect(problemsOf([FRONT_HOME], { minDistance: 5, maxDistance: 8 })).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_home distance 4 lies outside the distance limits [5, 8]',
      },
    ])
  })

  it('reports a close-up below the fallback minimum, which the home alone sets', () => {
    // The close-up at 1.5 sits below the home's fallback minimum of 2: the
    // controls would clamp it back out, so it fails by its own view.
    expect(problemsOf([FRONT_HOME, view('driver', frontRay(1.5))])).toEqual([
      {
        rule: 'view-within-distance-limits',
        message: 'the CAM_driver distance 1.5 lies outside the distance limits [2, 10]',
      },
    ])
  })

  it('passes a close-up an authored minimum brings in reach, and fails it just above', () => {
    const closeUp = view('driver', frontRay(1.5))
    expect(problemsOf([FRONT_HOME, closeUp], { minDistance: 1.5 })).toEqual([])
    expect(
      problemsOf([FRONT_HOME, closeUp], { minDistance: 1.5 * (1 + 1e-6) }).map(
        (problem) => problem.rule,
      ),
    ).toEqual(['view-within-distance-limits'])
  })

  it('reports every view outside the limits, in view order', () => {
    const result = problemsOf([view('driver', frontRay(1)), FRONT_HOME, view('knob', frontRay(11))])
    expect(result.map((problem) => problem.message)).toEqual([
      'the CAM_driver distance 1 lies outside the distance limits [2, 10]',
      'the CAM_knob distance 11 lies outside the distance limits [2, 10]',
    ])
  })

  it('reports a home outside the polar limits by its view', () => {
    expect(problemsOf([view('home', overheadRay(4))])).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_home polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports a close-up outside the polar limits by its view', () => {
    expect(problemsOf([FRONT_HOME, view('knob', overheadRay(3))])).toEqual([
      {
        rule: 'view-within-polar-limits',
        message: `the CAM_knob polar angle 0 lies outside the polar limits ${POLAR_RANGE_TEXT}`,
      },
    ])
  })

  it('reports the distance problems, then the reach problems, then the polar problems', () => {
    const result = problemsOf([view('home', overheadRay(4))], { minDistance: 1, maxDistance: 3 })
    expect(result.map((problem) => problem.rule)).toEqual([
      'view-within-distance-limits',
      'minimum-clears-reach',
      'view-within-polar-limits',
    ])
  })

  it('fails loudly when the views hold no home view', () => {
    expect(() => check([view('driver', frontRay(4))])).toThrow(
      "internal error: the contract views hold no home view 'home'",
    )
  })

  it('reports a broken view by its geometry and runs no limit rule on a broken home', () => {
    // The home's view ray passes the model center at a right angle, so it
    // has no orbit distance to derive the fallback limits from: the
    // authored minimum inside the model is not reported, and no limit
    // message carries a value the broken home could not give.
    const sideways: AuthoredCameraRay = { position: [0, 0, 4], forward: [1, 0, 0], fovY: 0.5 }
    const result = check([view('home', sideways), view('driver', { ...frontRay(4), fovY: 0 })], {
      minDistance: 1,
    })
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
      view('driver', { ...frontRay(4), position: [0, 0, Number.NaN] }),
      view('knob', frontRay(11)),
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

describe('cameraContractProblems over a close-up that orbits its anchor', () => {
  // The close-up at z 3 orbits the HS_driver anchor at z 1: its target is
  // the anchor itself, 2 units away, where the model reaches sqrt(2).
  const driver = view('driver', frontRay(3), anchorOf('driver', [0, 0, 1]))

  it('measures the orbit distance to the anchor, not to the model center', () => {
    // Around its anchor the close-up orbits at 2, inside a maximum of 2.5;
    // around the model center the same camera would orbit at 3.
    expect(problemsOf([FRONT_HOME, driver], { minDistance: 1.5, maxDistance: 4.5 })).toEqual([])
    expect(
      problemsOf([view('home', frontRay(2.5)), driver], { minDistance: 1.5, maxDistance: 2.5 }),
    ).toEqual([])
    expect(
      problemsOf([view('home', frontRay(2.5)), view('driver', frontRay(3))], {
        minDistance: 1.5,
        maxDistance: 2.5,
      }).map((problem) => problem.message),
    ).toEqual(['the CAM_driver distance 3 lies outside the distance limits [1.5, 2.5]'])
  })

  it('holds the home and the close-up to the reach from their own targets', () => {
    expect(problemsOf([view('home', frontRay(2)), driver], { maxDistance: 2.5 })).toEqual([
      {
        rule: 'minimum-clears-reach',
        message:
          'the sample-one CAM_home minimum distance 1 does not exceed the model reach 1 from its orbit target, projected from the model center',
      },
      {
        rule: 'minimum-clears-reach',
        message: `the sample-one CAM_driver minimum distance 1 does not exceed the model reach ${Math.SQRT2} from its orbit target, projected from the HS_driver anchor`,
      },
    ])
  })

  // The reach of the close-up's target is sqrt(2): a minimum above it
  // holds, one at it or below it fails by the close-up alone, since the
  // home's reach is 1.
  const rows: readonly {
    readonly name: string
    readonly minDistance: number
    readonly failing: boolean
  }[] = [
    { name: 'a minimum above the anchor reach holds', minDistance: 1.5, failing: false },
    { name: 'a minimum at the anchor reach fails', minDistance: Math.SQRT2, failing: true },
    { name: 'a minimum under the anchor reach fails', minDistance: 1.2, failing: true },
  ]

  it.each(rows)('$name', ({ minDistance, failing }) => {
    expect(problemsOf([FRONT_HOME, driver], { minDistance })).toEqual(
      failing
        ? [
            {
              rule: 'minimum-clears-reach',
              message: `the sample-one CAM_driver minimum distance ${minDistance} does not exceed the model reach ${Math.SQRT2} from its orbit target, projected from the HS_driver anchor`,
            },
          ]
        : [],
    )
  })

  it('reports a close-up whose anchor lies behind it by its geometry, naming the anchor', () => {
    const behind = view('driver', frontRay(3), anchorOf('driver', [0, 0, 5]))
    expect(problemsOf([FRONT_HOME, behind])).toEqual([
      {
        rule: 'view-pivot-ahead',
        message:
          'the camera CAM_driver orbits the HS_driver anchor, which projects 2 behind it on its view ray',
      },
    ])
  })
})
