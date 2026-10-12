import { describe, expect, it } from 'vitest'
import { viewGeometryProblems } from './geometry'
import type { AuthoredCameraRay, ViewPivot } from './view'

const MODEL_CENTER: ViewPivot = { point: [0, 0, 0], subject: 'the model center' }

// A sound view: in front of the model, looking at it.
const SOUND: AuthoredCameraRay = { position: [0, 0, 4], forward: [0, 0, -1], fovY: 0.5 }

function problemsOf(ray: AuthoredCameraRay, pivot: ViewPivot = MODEL_CENTER) {
  return viewGeometryProblems({ id: 'driver', ray, pivot })
}

type Row = {
  readonly name: string
  readonly ray: AuthoredCameraRay
  readonly expected: readonly { readonly rule: string; readonly message: string }[]
}

const rows: Row[] = [
  { name: 'a sound view', ray: SOUND, expected: [] },
  {
    name: 'a non-finite position',
    ray: { ...SOUND, position: [0, Number.NaN, 4] },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite position' },
    ],
  },
  {
    name: 'a non-finite view direction',
    ray: { ...SOUND, forward: [0, 0, Number.POSITIVE_INFINITY] },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite view direction' },
    ],
  },
  {
    name: 'a non-finite field of view',
    ray: { ...SOUND, fovY: Number.NaN },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite field of view' },
    ],
  },
  {
    name: 'a zero field of view',
    ray: { ...SOUND, fovY: 0 },
    expected: [
      {
        rule: 'view-field-of-view',
        message: `the camera CAM_driver has a field of view of 0 rad, outside the open range (0, ${Math.PI})`,
      },
    ],
  },
  {
    name: 'a field of view of a half turn',
    ray: { ...SOUND, fovY: Math.PI },
    expected: [
      {
        rule: 'view-field-of-view',
        message: `the camera CAM_driver has a field of view of ${Math.PI} rad, outside the open range (0, ${Math.PI})`,
      },
    ],
  },
  {
    name: 'a non-finite orbit target from a direction that overflows',
    ray: { ...SOUND, forward: [0, 0, -Number.MAX_VALUE] },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite orbit target' },
    ],
  },
  {
    name: 'a non-finite orbit distance from a target that overflows it',
    ray: { position: [0, 0, -Number.MAX_VALUE], forward: [0, 0, 1], fovY: 0.5 },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite orbit distance' },
    ],
  },
  {
    name: 'a view ray that passes the model center at a right angle',
    ray: { position: [0, 0, 4], forward: [1, 0, 0], fovY: 0.5 },
    expected: [
      {
        rule: 'view-orbit-distance',
        message:
          'the camera CAM_driver orbits its own position: its view ray passes the model center at a right angle',
      },
    ],
  },
]

// The pivot the orbit target is projected from must project in front of
// the camera: behind it the target would sit behind the eye, beside it the
// camera would orbit its own position. Each problem names the pivot.
const anchorRows: readonly {
  readonly name: string
  readonly pivot: ViewPivot
  readonly expected: readonly { readonly rule: string; readonly message: string }[]
}[] = [
  {
    name: 'an anchor in front of the camera',
    pivot: { point: [0.2, 0.1, 1], subject: 'the HS_driver anchor' },
    expected: [],
  },
  {
    name: 'an anchor just in front of the camera',
    pivot: { point: [0.5, 0, 3.999], subject: 'the HS_driver anchor' },
    expected: [],
  },
  {
    name: 'an anchor behind the camera',
    pivot: { point: [1, 2, 6], subject: 'the HS_driver anchor' },
    expected: [
      {
        rule: 'view-pivot-ahead',
        message:
          'the camera CAM_driver orbits the HS_driver anchor, which projects 2 behind it on its view ray',
      },
    ],
  },
  {
    name: 'an anchor beside the camera, at a right angle to its ray',
    pivot: { point: [1, 0, 4], subject: 'the HS_driver anchor' },
    expected: [
      {
        rule: 'view-orbit-distance',
        message:
          'the camera CAM_driver orbits its own position: its view ray passes the HS_driver anchor at a right angle',
      },
    ],
  },
  {
    name: 'a non-finite anchor',
    pivot: { point: [0, Number.NaN, 1], subject: 'the HS_driver anchor' },
    expected: [
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite orbit target' },
    ],
  },
]

describe('viewGeometryProblems', () => {
  it.each(rows)('$name', ({ ray, expected }) => {
    expect(problemsOf(ray)).toEqual(expected)
  })

  it.each(anchorRows)('$name', ({ pivot, expected }) => {
    expect(problemsOf(SOUND, pivot)).toEqual(expected)
  })

  it('reports every broken authored fact once, before any derived orbit fact', () => {
    expect(
      problemsOf({ position: [Number.NaN, 0, 0], forward: [0, Number.NaN, 0], fovY: Number.NaN }),
    ).toEqual([
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite position' },
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite view direction' },
      { rule: 'finite-views', message: 'the camera CAM_driver has a non-finite field of view' },
    ])
  })
})
