import { describe, expect, it } from 'vitest'
import { viewPivotOf } from './pivot'
import type { Vec3 } from './view'

const CENTER: Vec3 = [0.1, 0.2, 0.3]
const RESTS: ReadonlyMap<string, Vec3> = new Map([
  ['driver', [0.4, 0.5, 0.6]],
  ['knob', [-0.4, 0.5, -0.6]],
])

// The one pivot rule, over every kind of view: the home view orbits the
// model center whatever anchors there are, a close-up orbits its own
// anchor's rest, never another one's, and a close-up without an anchor
// rest is a problem, never the center.
describe('viewPivotOf', () => {
  const rows: readonly {
    readonly name: string
    readonly viewId: string
    readonly rests: ReadonlyMap<string, Vec3>
    readonly expected: ReturnType<typeof viewPivotOf>
  }[] = [
    {
      name: 'the home view orbits the model center',
      viewId: 'home',
      rests: RESTS,
      expected: { kind: 'chosen', pivot: { point: CENTER, subject: 'the model center' } },
    },
    {
      name: 'the home view orbits the model center with no anchors at all',
      viewId: 'home',
      rests: new Map(),
      expected: { kind: 'chosen', pivot: { point: CENTER, subject: 'the model center' } },
    },
    {
      name: 'a close-up orbits its own anchor at rest',
      viewId: 'driver',
      rests: RESTS,
      expected: {
        kind: 'chosen',
        pivot: { point: [0.4, 0.5, 0.6], subject: 'the HS_driver anchor' },
      },
    },
    {
      name: 'another close-up orbits its own anchor, not the first one',
      viewId: 'knob',
      rests: RESTS,
      expected: {
        kind: 'chosen',
        pivot: { point: [-0.4, 0.5, -0.6], subject: 'the HS_knob anchor' },
      },
    },
    {
      name: 'a close-up without an anchor rest is a problem, not the model center',
      viewId: 'grille',
      rests: RESTS,
      expected: {
        kind: 'broken',
        problem: {
          rule: 'close-up-orbits-its-anchor',
          message: 'the camera CAM_grille has no HS_grille anchor at rest to orbit',
        },
      },
    },
  ]

  it.each(rows)('$name', ({ viewId, rests, expected }) => {
    expect(viewPivotOf(viewId, CENTER, rests)).toEqual(expected)
  })
})
