import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three/webgpu'
import { buildCameraPlan } from './productPlan'
import {
  brokenMessages,
  brokenProblems,
  centeredFrame,
  cubeFrame,
  manifestWith,
  mountedTree,
  planned,
  raisedFrame,
  restsAt,
  rigWith,
} from './productPlanFixtures'

// The camera limit rules the builder holds every authored view to: the
// home and every close-up inside the distance and polar limits, and the
// minimum distance beyond the model's reach from every view's target. A
// broken rule is a broken build with every problem named, never a throw.

describe('buildCameraPlan limit rules', () => {
  it('reports every broken rule named when the home sits outside the limits', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    // The authored maximum pulls the home distance 1.2 outside [0.4, 1.1],
    // and the authored minimum falls short of the model's reach of about
    // 0.41 from the home target, which the minimum must exceed.
    const problems = brokenProblems(
      buildCameraPlan(
        rigWith([home]),
        manifestWith({ minDistance: 0.4, maxDistance: 1.1 }),
        raisedFrame,
      ),
    )
    expect(problems.map((problem) => problem.rule)).toEqual([
      'view-within-distance-limits',
      'minimum-clears-reach',
    ])
    expect(problems[0]?.message).toContain('CAM_home')
  })

  it('reports a minimum that does not clear the model reach', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    expect(
      brokenMessages(
        buildCameraPlan(rigWith([home]), manifestWith({ minDistance: 0.35 }), raisedFrame),
      ),
    ).toMatch(
      /^the sample-one CAM_home minimum distance 0\.35 does not exceed the model reach 0\.41\d* from its orbit target, projected from the model center$/,
    )
  })

  it('reports a close-up orbit distance below the minimum, naming the view', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.3)
    mountedTree([home, closeUp], centeredFrame)

    // The authored minimum 0.5 clears the model radius but sits above the
    // close-up's 0.3 orbit distance, so the controls would clamp the
    // close-up back out; the plan reports it instead.
    const problems = brokenProblems(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0, 0], ['driver'])),
        manifestWith({ minDistance: 0.5 }),
        centeredFrame,
      ),
    )
    expect(problems.map((problem) => problem.rule)).toEqual(['view-within-distance-limits'])
    expect(problems[0]?.message).toContain('CAM_driver')
    expect(problems[0]?.message).toContain('0.3')
  })

  it('passes when a close-up orbit distance sits inside the limits', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.6)
    mountedTree([home, closeUp], centeredFrame)

    const plan = planned(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0, 0], ['driver'])),
        manifestWith({ minDistance: 0.4 }),
        centeredFrame,
      ),
    )

    expect([...plan.views.keys()]).toEqual(['home', 'driver'])
  })

  it('reports a home polar angle outside the configured limits, naming the view', () => {
    // A camera aimed straight down from above the model: its polar angle
    // is nearly 0, below the configured minimum, while the distances stay
    // inside their limits.
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 5, 0)
    home.lookAt(0, 0, 0)
    mountedTree([home], centeredFrame)

    expect(
      brokenMessages(buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame)),
    ).toMatch(/the CAM_home polar angle/)
  })

  it('reports a close-up polar angle outside the configured limits, naming the view', () => {
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

    const problems = brokenProblems(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0, 0], ['driver'])),
        manifestWith(undefined),
        centeredFrame,
      ),
    )
    expect(problems.map((problem) => problem.rule)).toEqual(['view-within-polar-limits'])
    expect(problems[0]?.message).toContain('CAM_driver')
  })

  it('reports a close-up whose anchor the minimum does not clear, as a typed broken build', () => {
    // The close-up at 0.7 orbits its anchor at (0, 0, 0.1), 0.6 away, where
    // the model reaches sqrt(0.34), about 0.583: an authored minimum of 0.55
    // keeps the orbit distance inside the limits and the home's reach of
    // sqrt(0.27) cleared, so the close-up's reach is the one rule it breaks;
    // a minimum of 0.59 clears it.
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.7)
    const frame = cubeFrame([0, 0, 0], 0.3)
    mountedTree([home, closeUp], frame)
    const rig = rigWith([home, closeUp], restsAt([0, 0, 0.1], ['driver']))

    const problems = brokenProblems(
      buildCameraPlan(rig, manifestWith({ minDistance: 0.55 }), frame),
    )
    expect(problems.map((problem) => problem.rule)).toEqual(['minimum-clears-reach'])
    expect(problems[0]?.message).toMatch(
      /^the sample-one CAM_driver minimum distance 0\.55 does not exceed the model reach 0\.583\d* from its orbit target, projected from the HS_driver anchor$/,
    )
    expect(buildCameraPlan(rig, manifestWith({ minDistance: 0.59 }), frame).kind).toBe('planned')
  })
})
