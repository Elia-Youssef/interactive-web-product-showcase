import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { CameraLimitsError } from '@lib/camera/errors'
import { buildCameraPlan } from './productPlan'
import {
  centeredFrame,
  manifestWith,
  mountedTree,
  raisedFrame,
  rigWith,
} from './productPlanFixtures'

// The camera limit rules the builder holds every authored view to: the
// home and every close-up inside the distance and polar limits, and the
// minimum distance clear of the model. A broken rule fails the plan with
// every problem named.

describe('buildCameraPlan limit rules', () => {
  it('fails with every broken rule named when the home sits outside the limits', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    // The authored maximum pulls the home distance 1.2 outside [0.4, 1.1],
    // and the authored minimum only reaches the model's radius of 0.4,
    // which the minimum must exceed.
    try {
      buildCameraPlan(
        rigWith([home]),
        manifestWith({ minDistance: 0.4, maxDistance: 1.1 }),
        raisedFrame,
      )
      throw new Error('the broken limits must fail the plan')
    } catch (error) {
      if (!(error instanceof CameraLimitsError)) {
        throw error
      }
      expect(error.subject).toBe('sample-one')
      expect(error.problems.map((problem) => problem.rule)).toEqual([
        'view-within-distance-limits',
        'minimum-clears-the-model',
      ])
      expect(error.problems[0]?.message).toContain('CAM_home')
    }
  })

  it('fails when the minimum does not clear the model radius', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    expect(() =>
      buildCameraPlan(rigWith([home]), manifestWith({ minDistance: 0.35 }), raisedFrame),
    ).toThrow(/minimum distance 0.35 does not exceed the model radius 0.4/)
  })

  it('fails when a close-up orbit distance sits below the minimum, naming the view', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.3)
    mountedTree([home, closeUp], centeredFrame)

    // The authored minimum 0.5 clears the model radius but sits above the
    // close-up's 0.3 orbit distance, so the controls would clamp the
    // close-up back out; the plan fails on it instead.
    try {
      buildCameraPlan(rigWith([home, closeUp]), manifestWith({ minDistance: 0.5 }), centeredFrame)
      throw new Error('the clamped close-up must fail the plan')
    } catch (error) {
      if (!(error instanceof CameraLimitsError)) {
        throw error
      }
      expect(error.problems.map((problem) => problem.rule)).toEqual(['view-within-distance-limits'])
      expect(error.problems[0]?.message).toContain('CAM_driver')
      expect(error.problems[0]?.message).toContain('0.3')
    }
  })

  it('passes when a close-up orbit distance sits inside the limits', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.6)
    mountedTree([home, closeUp], centeredFrame)

    const plan = buildCameraPlan(
      rigWith([home, closeUp]),
      manifestWith({ minDistance: 0.4 }),
      centeredFrame,
    )

    expect([...plan.views.keys()]).toEqual(['home', 'driver'])
  })

  it('fails when a close-up polar angle sits outside the configured limits, naming the view', () => {
    // The home view is level with the model (polar 90 degrees, inside the
    // configured limits); the close-up hangs above the model at a distance
    // the limits allow and is aimed straight down, whose polar angle is
    // nearly 0, below the configured minimum.
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 2, 0)
    closeUp.lookAt(0, 0, 0)
    mountedTree([home, closeUp], centeredFrame)

    try {
      buildCameraPlan(rigWith([home, closeUp]), manifestWith(undefined), centeredFrame)
      throw new Error('the unreachable close-up must fail the plan')
    } catch (error) {
      if (!(error instanceof CameraLimitsError)) {
        throw error
      }
      expect(error.problems.map((problem) => problem.rule)).toEqual(['view-within-polar-limits'])
      expect(error.problems[0]?.message).toContain('CAM_driver')
    }
  })
})
