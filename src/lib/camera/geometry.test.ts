import { describe, expect, it } from 'vitest'
import { viewGeometryProblems } from './geometry'
import type { AuthoredCameraRay, Vec3 } from './view'

const CENTER: Vec3 = [0, 0, 0]

// A sound view: in front of the model, looking at it.
const SOUND: AuthoredCameraRay = { position: [0, 0, 4], forward: [0, 0, -1], fovY: 0.5 }

function problemsOf(ray: AuthoredCameraRay) {
  return viewGeometryProblems({ id: 'driver', ray }, CENTER)
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
    ray: { position: [0, 0, Number.MAX_VALUE], forward: [0, 0, 1], fovY: 0.5 },
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

describe('viewGeometryProblems', () => {
  it.each(rows)('$name', ({ ray, expected }) => {
    expect(problemsOf(ray)).toEqual(expected)
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
