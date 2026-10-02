import { describe, expect, it } from 'vitest'
import type { Camera } from 'three'
import { AnimationClip, Group, Object3D, OrthographicCamera, PerspectiveCamera } from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import { CameraLimitsError } from '@lib/camera/errors'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import { stageCameraConfig } from './config'
import { buildCameraPlan } from './productPlan'

// The parsed manifest the plan builds against, with the camera block each
// case overrides, so the builder reads the real schema output.
function manifestWith(camera: { minDistance?: number; maxDistance?: number } | undefined) {
  return parseProduct({ ...sampleOneManifest, camera }, 'sample-one.test')
}

// Rig fixtures for the builder: only its cameras enter the plan, so the
// rest holds minimal stand-ins.
function rigWith(cameras: readonly PerspectiveCamera[]): ProductRig {
  return {
    parts: new Map(),
    hotspots: [],
    cameras: new Map(cameras.map((camera) => [camera.name.slice('CAM_'.length), camera])),
    shadow: new Object3D(),
    clip: new AnimationClip('Explode', 1, []),
    variants: [],
  }
}

// The measured frame of the fixture model: its center rides 0.1 above the
// floor, which the centering group offsets.
const frame: ModelFrame = {
  centerX: 0,
  centerY: 0.1,
  centerZ: 0,
  radius: 0.4,
  meshes: 1,
  triangles: 12,
}

// A centered frame: no centering offset, a small radius.
const centeredFrame: ModelFrame = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  radius: 0.05,
  meshes: 1,
  triangles: 12,
}

// Mounts the cameras under a centering group offset, the way the loaded
// product's tree is centered on the origin.
function mountedTree(cameras: readonly PerspectiveCamera[], offset: ModelFrame = frame): Group {
  const group = new Group()
  group.position.set(-offset.centerX, -offset.centerY, -offset.centerZ)
  const scene = new Object3D()
  for (const camera of cameras) {
    scene.add(camera)
  }
  group.add(scene)
  return group
}

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

    const plan = buildCameraPlan(rigWith([home, closeUp]), manifestWith(undefined), frame)

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

  it('projects the target onto an angled view ray closest to the origin', () => {
    const home = new PerspectiveCamera(25, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(2, 1, 3)
    home.lookAt(4, 3, 0)
    mountedTree([home], centeredFrame)

    const plan = buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame)

    const view = plan.views.get('home')
    if (view === undefined) {
      throw new Error('the home view must be in the plan')
    }
    // The ray from (2,1,3) toward (4,3,0) passes closest to the origin at
    // the origin's projection onto it, so the vector from the target to
    // the origin is perpendicular to the ray.
    const [tx, ty, tz] = view.target
    const ray: [number, number, number] = [4 - 2, 3 - 1, 0 - 3]
    const [rx, ry, rz] = ray
    const dot = -rx * tx - ry * ty - rz * tz
    expect(dot).toBeCloseTo(0, 9)
  })

  it('carries the home distance limits at the authored aspect, from the ratios', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home], centeredFrame)

    const plan = buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame)

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

    const plan = buildCameraPlan(
      rigWith([home]),
      manifestWith({ minDistance: 0.9, maxDistance: 3 }),
      centeredFrame,
    )

    expect(plan.distanceRange).toEqual({ min: 0.9, max: 3 })
  })

  it('fails with every broken rule named when the home sits outside the limits', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    // The authored maximum pulls the home distance 1.2 outside [0.4, 1.1],
    // and the authored minimum only reaches the model's radius of 0.4,
    // which the minimum must exceed.
    try {
      buildCameraPlan(rigWith([home]), manifestWith({ minDistance: 0.4, maxDistance: 1.1 }), frame)
      throw new Error('the broken limits must fail the plan')
    } catch (error) {
      if (!(error instanceof CameraLimitsError)) {
        throw error
      }
      expect(error.subject).toBe('sample-one')
      expect(error.problems.map((problem) => problem.rule)).toEqual([
        'home-within-distance-limits',
        'minimum-clears-the-model',
      ])
    }
  })

  it('fails when the minimum does not clear the model radius', () => {
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 0, 1.2)
    mountedTree([home])

    expect(() =>
      buildCameraPlan(rigWith([home]), manifestWith({ minDistance: 0.35 }), frame),
    ).toThrow(/minimum distance 0.35 does not exceed the model radius 0.4/)
  })

  it('fails when the home polar angle sits outside the configured limits', () => {
    // A camera aimed straight down from above the model: its polar angle
    // is nearly 0, below the configured minimum, while the distances stay
    // inside their limits.
    const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
    home.name = 'CAM_home'
    home.position.set(0, 5, 0)
    home.lookAt(0, 0, 0)
    mountedTree([home], centeredFrame)

    expect(() => buildCameraPlan(rigWith([home]), manifestWith(undefined), centeredFrame)).toThrow(
      /home polar angle/,
    )
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
    }

    expect(() => buildCameraPlan(rig, manifestWith(undefined), centeredFrame)).toThrow(
      /CAM_driver does not carry a perspective camera/,
    )
  })
})
