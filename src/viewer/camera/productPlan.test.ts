import { describe, expect, it } from 'vitest'
import type { Camera } from 'three'
import { AnimationClip, Object3D, OrthographicCamera, PerspectiveCamera } from 'three'
import type { ProductRig } from '../rig/productRig'
import { stageCameraConfig } from './config'
import { buildCameraPlan } from './productPlan'
import {
  brokenMessages,
  brokenProblems,
  centeredFrame,
  manifestWith,
  mountedTree,
  planned,
  raisedFrame,
  restsAt,
  rigWith,
} from './productPlanFixtures'

// The plan the builder makes from a well-formed rig: its views, its lens,
// its clip range and its limits, and the authored data it rejects as a
// broken build. The limit rules every view is held to live in
// productPlanLimits.test.ts.

describe('buildCameraPlan', () => {
  it('builds a view per rig camera from the centered world transforms', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0.2, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0.3, 0.3, 0.8)
    closeUp.lookAt(0, 0.1, 0)
    mountedTree([home, closeUp])

    // The close-up's anchor rests at the model center, in the model's own
    // space, where the close-up looks.
    const plan = planned(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0.1, 0], ['driver'])),
        manifestWith(undefined),
        raisedFrame,
      ),
    )

    expect([...plan.views.keys()]).toEqual(['home', 'driver'])
    const homeView = plan.views.get('home')
    if (homeView === undefined) {
      throw new Error('the home view must be in the plan')
    }
    // The world position carries the centering offset, and the target is
    // the origin projected onto the view ray, which the default camera
    // points straight down -Z: the target sits level with the camera.
    expect(homeView.position).toEqual([0, 0.1, 1.2])
    expect(homeView.target).toEqual([0, 0.1, 0])
    expect(homeView.fovY).toBeCloseTo((30 * Math.PI) / 180, 15)
    expect(homeView.near).toBe(0.05)
    expect(homeView.far).toBe(25)
  })

  it('carries the home lens as the plan base for the zoom channel', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0.3, 0.3, 0.8)
    closeUp.lookAt(0, 0.1, 0)
    mountedTree([home, closeUp], centeredFrame)

    const plan = planned(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0, 0], ['driver'])),
        manifestWith(undefined),
        centeredFrame,
      ),
    )

    const homeView = plan.views.get('home')
    if (homeView === undefined) {
      throw new Error('the home view must be in the plan')
    }
    // The base is the home view's own lens, the one value the zoom math
    // turns into every view's lens.
    expect(plan.baseFovY).toBe(homeView.fovY)
    expect(plan.baseFovY).toBeCloseTo((30 * Math.PI) / 180, 15)
  })

  it('carries one clip range across the views: the smallest near and the largest far', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.2, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 40)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0.3, 0.3, 0.8)
    closeUp.lookAt(0, 0.1, 0)
    mountedTree([home, closeUp], centeredFrame)

    const plan = planned(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0, 0, 0], ['driver'])),
        manifestWith(undefined),
        centeredFrame,
      ),
    )

    expect(plan.clipRange).toEqual({ near: 0.05, far: 40 })
  })

  it('projects the target onto an angled view ray closest to the origin', () => {
    const home = new PerspectiveCamera(25, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(2, 1, 3)
    home.lookAt(0.1, -0.05, 0)
    mountedTree([home], centeredFrame)

    const plan = planned(buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame))

    const view = plan.views.get('home')
    if (view === undefined) {
      throw new Error('the home view must be in the plan')
    }
    // The ray from (2,1,3) toward (0.1,-0.05,0) passes closest to the
    // origin at the origin's projection onto it, so the vector from the
    // target to the origin is perpendicular to the ray.
    const [tx, ty, tz] = view.target
    const ray: [number, number, number] = [0.1 - 2, -0.05 - 1, 0 - 3]
    const [rx, ry, rz] = ray
    const dot = -rx * tx - ry * ty - rz * tz
    expect(dot).toBeCloseTo(0, 9)
  })

  it('carries the home distance limits at the authored aspect, from the ratios', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home], centeredFrame)

    const plan = planned(buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame))

    expect(plan.authoredAspect).toBe(1.6)
    expect(plan.distanceRange.min).toBeCloseTo(1.2 * stageCameraConfig.minHomeDistanceRatio, 15)
    expect(plan.distanceRange.max).toBeCloseTo(1.2 * stageCameraConfig.maxHomeDistanceRatio, 15)
    expect(plan.polarRange.min).toBeCloseTo(
      (stageCameraConfig.minPolarAngleDegrees * Math.PI) / 180,
      15,
    )
    expect(plan.polarRange.max).toBeCloseTo(
      (stageCameraConfig.maxPolarAngleDegrees * Math.PI) / 180,
      15,
    )
  })

  it('lets the authored distance limits win over the ratios', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home], centeredFrame)

    const plan = planned(
      buildCameraPlan(
        rigWith([home]),
        manifestWith({ minDistance: 0.9, maxDistance: 3 }),
        centeredFrame,
      ),
    )

    expect(plan.distanceRange).toEqual({ min: 0.9, max: 3 })
  })

  it('fails when an authored camera is not perspective', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.05, 25)
    ortho.name = 'CAM_driver'
    mountedTree([home], centeredFrame)
    const rig: ProductRig = {
      parts: new Map(),
      hotspots: [],
      cameras: new Map<string, Camera>([
        ['home', home],
        ['driver', ortho],
      ]),
      shadow: new Object3D(),
      clip: new AnimationClip('Explode', 1, []),
      variants: [],
      anchorRest: restsAt([0, 0, 0], ['driver']),
    }

    expect(brokenMessages(buildCameraPlan(rig, manifestWith(undefined), centeredFrame))).toMatch(
      /CAM_driver does not carry a perspective camera/,
    )
  })

  it('rejects a degenerate view as a value, before any frame could present it', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    // A close-up authored at its own anchor: the closest point of its view
    // ray to the anchor is its own position, so it has no orbit.
    const inside = new PerspectiveCamera(30, 1.6, 0.05, 25)
    inside.name = 'CAM_driver'
    mountedTree([home, inside], centeredFrame)

    const build = buildCameraPlan(
      rigWith([home, inside], restsAt([0, 0, 0], ['driver'])),
      manifestWith(undefined),
      centeredFrame,
    )
    expect(brokenProblems(build).map((problem) => problem.rule)).toEqual(['view-orbit-distance'])
  })

  it('rejects a close-up whose anchor has no rest as a value, never orbiting the center', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    const closeUp = new PerspectiveCamera(45, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0, 0, 0.8)
    mountedTree([home, closeUp], centeredFrame)

    const build = buildCameraPlan(rigWith([home, closeUp]), manifestWith(undefined), centeredFrame)
    expect(brokenProblems(build)).toEqual([
      {
        rule: 'close-up-orbits-its-anchor',
        message: 'the camera CAM_driver has no HS_driver anchor at rest to orbit',
      },
    ])
  })

  it('orbits a close-up around its anchor rest, moved into stage space by the frame center', () => {
    // The anchor rests at (0.25, 0.1, 0.25) in the model's own space; the
    // centering group moves it to (0.25, 0, 0.25) in stage space, and the
    // close-up looking down -Z from (0.25, 0, 1) orbits it at 0.75.
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0.1, 1.4)
    const closeUp = new PerspectiveCamera(30, 1.6, 0.05, 25)
    closeUp.name = 'CAM_driver'
    closeUp.position.set(0.25, 0.1, 1)
    mountedTree([home, closeUp])

    const plan = planned(
      buildCameraPlan(
        rigWith([home, closeUp], restsAt([0.25, 0.1, 0.25], ['driver'])),
        manifestWith(undefined),
        raisedFrame,
      ),
    )

    expect(plan.views.get('driver')?.position).toEqual([0.25, 0, 1])
    expect(plan.views.get('driver')?.target).toEqual([0.25, 0, 0.25])
  })
})
