// The camera contract assembly at the explode's last key: the home view's
// reach over the parts' exploded bounds, home alone (the close-ups apply
// only to the assembled product), the authored minimum read the same way,
// and no rule without part geometry to pose. The exact rule wording is part
// of the contract.
import { describe, expect, it } from 'vitest'
import { cameraContractProblems } from './contract'
import { cameraLimitConfig } from './config'
import type { ModelBounds } from './frame'
import type { AuthoredDistanceLimits } from './limits'
import type { AuthoredCameraRay, NamedCameraRay, ViewPivot } from './view'

const MODEL_CENTER: ViewPivot = { point: [0, 0, 0], subject: 'the model center' }

// A camera on the +Z axis at the given distance, looking at the model.
function frontRay(distance: number): AuthoredCameraRay {
  return { position: [0, 0, distance], forward: [0, 0, -1], fovY: 0.5 }
}

function view(id: string, ray: AuthoredCameraRay): NamedCameraRay {
  return { id, ray, pivot: MODEL_CENTER }
}

const FRONT_HOME = view('home', frontRay(4))

function check(
  views: readonly NamedCameraRay[],
  authored: AuthoredDistanceLimits,
  explodedBounds: ModelBounds | null,
) {
  return cameraContractProblems({
    product: 'sample-one',
    views,
    homeId: 'home',
    bounds: { min: [-1, 0, 0], max: [1, 0, 0] },
    explodedBounds,
    authoredDistanceLimits: authored,
    limits: cameraLimitConfig,
  })
}

describe("cameraContractProblems at the explode's last key", () => {
  // The parts travel outward to a box three units long either side of the
  // origin along X: from the home target at the center the exploded reach
  // is 3, against the rest model's 1.
  const EXPLODED: ModelBounds = { min: [-3, 0, 0], max: [3, 0, 0] }

  // The problems of a check whose exploded bounds are given.
  function explodedProblemsOf(exploded: ModelBounds | null, authored: AuthoredDistanceLimits = {}) {
    const result = check([FRONT_HOME, view('driver', frontRay(2.5))], authored, exploded)
    return result.kind === 'broken' ? result.problems : []
  }

  it('holds the home view to the exploded reach, not the close-ups', () => {
    // The fallback minimum of 2 clears the rest reach of 1 but not the
    // exploded reach of 3: only the home view fails, by the exploded rule.
    expect(explodedProblemsOf(EXPLODED)).toEqual([
      {
        rule: 'minimum-clears-exploded-reach',
        message:
          "the sample-one CAM_home minimum distance 2 does not exceed the model reach 3 at the explode's last key from its orbit target, projected from the model center",
      },
    ])
  })

  it('passes an exploded pose that stays inside the minimum', () => {
    expect(explodedProblemsOf({ min: [-1.5, 0, 0], max: [1.5, 0, 0] })).toEqual([])
  })

  it('measures the exploded reach from the home target the pivot rule chose', () => {
    // The home camera looks down -Z from z 4 at the model center at the
    // origin; its target is the center, wherever the model center sits.
    const offCenter: ModelBounds = { min: [2, 0, 0], max: [4, 0, 0] }
    expect(explodedProblemsOf(offCenter)).toEqual([
      {
        rule: 'minimum-clears-exploded-reach',
        message:
          "the sample-one CAM_home minimum distance 2 does not exceed the model reach 4 at the explode's last key from its orbit target, projected from the model center",
      },
    ])
  })

  it('reads an authored minimum the same way', () => {
    // The home view alone, so an authored minimum above the close-up's
    // distance adds no violation of its own.
    const homeOnly = (authored: AuthoredDistanceLimits) => {
      const result = check([FRONT_HOME], authored, EXPLODED)
      return result.kind === 'broken' ? result.problems : []
    }
    expect(homeOnly({ minDistance: 3 })).toEqual([
      {
        rule: 'minimum-clears-exploded-reach',
        message:
          "the sample-one CAM_home minimum distance 3 does not exceed the model reach 3 at the explode's last key from its orbit target, projected from the model center",
      },
    ])
    expect(homeOnly({ minDistance: 3.5 })).toEqual([])
  })

  it('runs no exploded rule without part geometry to pose', () => {
    expect(explodedProblemsOf(null)).toEqual([])
  })
})
