// The reach rule at the explode's last key, over orbits and exploded
// bounds: the home view's own target, the strict minimum, and the message
// that names the clip's end. The exact rule wording is part of the
// contract.
import { describe, expect, it } from 'vitest'
import { explodedReachLimitProblems, type ViewOrbit } from './limits'

describe('explodedReachLimitProblems', () => {
  // The home orbit the exploded rule measures from, around the center.
  const home = (target: readonly [number, number, number]): ViewOrbit => ({
    id: 'home',
    target,
    distance: 1.5,
    polar: 1.2,
    reach: 0.5,
    pivot: 'the model center',
  })

  // The parts' box at the fully exploded pose: a rod from x 2 to x 4.
  const EXPLODED = { min: [2, 0, 0] as const, max: [4, 0, 0] as const }

  it('passes a minimum beyond the exploded reach', () => {
    expect(
      explodedReachLimitProblems({ min: 4.5, max: 9 }, home([0, 0, 0]), EXPLODED, 's'),
    ).toEqual([])
  })

  it('fails a minimum at or under the exploded reach, naming the explode end', () => {
    for (const min of [4, 3]) {
      expect(explodedReachLimitProblems({ min, max: 9 }, home([0, 0, 0]), EXPLODED, 's')).toEqual([
        {
          rule: 'minimum-clears-exploded-reach',
          message:
            `the s CAM_home minimum distance ${min} does not exceed the model reach 4 at the explode's last key ` +
            'from its orbit target, projected from the model center',
        },
      ])
    }
  })

  it('measures from the home view own target, not the model center', () => {
    // A target inside the exploded box reaches farther than any corner
    // distance from the origin: the rule reads the target it is given.
    expect(explodedReachLimitProblems({ min: 1, max: 9 }, home([3, 0, 0]), EXPLODED, 's')).toEqual([
      {
        rule: 'minimum-clears-exploded-reach',
        message:
          "the s CAM_home minimum distance 1 does not exceed the model reach 1 at the explode's last key " +
          'from its orbit target, projected from the model center',
      },
    ])
  })
})
