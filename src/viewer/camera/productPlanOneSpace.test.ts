// The one-space rule of the camera plan: the plan checks in stage space
// (the rays read after centering, the center at the stage origin), and the
// same check over the model-space facts must agree, because the geometry is
// translation invariant. A check that read the ray in one space and the
// center in another disagrees by the dot product of center and forward,
// which is what the off-origin, pitched-camera table catches.
import { describe, expect, it } from 'vitest'
import { AnimationClip, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import { CameraLimitsError } from '@lib/camera/errors'
import { cameraContractProblems } from '@lib/camera/contract'
import { cameraLimitConfig } from '@lib/camera/config'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
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

// A frame whose center sits at the given model-space point.
function frameAt(center: [number, number, number]): ModelFrame {
  return {
    centerX: center[0],
    centerY: center[1],
    centerZ: center[2],
    radius: 0.4,
    meshes: 1,
    triangles: 12,
  }
}

// The problems the plan throws for the given manifest camera block.
function planProblems(
  rig: ProductRig,
  modelFrame: ModelFrame,
  camera: { minDistance?: number; maxDistance?: number },
) {
  try {
    buildCameraPlan(rig, manifestWith(camera), modelFrame)
  } catch (error) {
    if (error instanceof CameraLimitsError) {
      return error.problems
    }
    throw error
  }
  throw new Error('the broken limits must fail the plan')
}

// Mounts the cameras under a centering group offset, the way the loaded
// product's tree is centered on the origin.
function mountedTree(cameras: readonly PerspectiveCamera[], offset: ModelFrame): Object3D {
  const group = new Object3D()
  group.position.set(-offset.centerX, -offset.centerY, -offset.centerZ)
  const scene = new Object3D()
  for (const camera of cameras) {
    scene.add(camera)
  }
  group.add(scene)
  return group
}

// Frames off the origin, home cameras pitched at the frame, so the view
// projection couples the ray and the center. The plan checks in stage space
// and the assembly here in model space (rays as authored, center as
// measured); the same-space check agrees in the rules, in the resolved
// ranges, and in the distance up to the last-ulp rounding where the two
// same-space subtractions differ, while a mixed-space check is off by per
// cent.
const offOriginCases = [
  { center: [0.4, 0.3, -0.2] as const, camera: [1.5, 0.9, 1.2] as const },
  { center: [-0.5, 0.2, 0.3] as const, camera: [0.8, 1.4, 0.9] as const },
  { center: [0.3, -0.4, 0.25] as const, camera: [0.9, -0.1, 1.1] as const },
]

describe('the plan checks one space', () => {
  it.each(offOriginCases)(
    'checks one space for the frame at $center with the home at $camera',
    ({ center, camera }) => {
      const modelFrame = frameAt([center[0], center[1], center[2]])
      const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
      home.name = 'CAM_home'
      home.position.set(camera[0], camera[1], camera[2])
      home.lookAt(center[0], center[1], center[2])
      mountedTree([home], modelFrame)

      // The authored limits pin the resolved range exactly, so the range
      // comparison cannot hide the distance the check used.
      const cameraBlock = { minDistance: 50, maxDistance: 60 }
      const problems = planProblems(rigWith([home]), modelFrame, cameraBlock)

      const forward = new Vector3(center[0], center[1], center[2])
        .sub(new Vector3(camera[0], camera[1], camera[2]))
        .normalize()
      const ray = {
        position: [camera[0], camera[1], camera[2]] as const,
        forward: [forward.x, forward.y, forward.z] as const,
        fovY: (30 * Math.PI) / 180,
      }
      const modelSpace = cameraContractProblems({
        views: [ray],
        home: ray,
        frame: { center, radius: modelFrame.radius },
        authoredDistanceLimits: cameraBlock,
        limits: cameraLimitConfig,
      })

      expect(problems.map((problem) => problem.rule)).toEqual(
        modelSpace.problems.map((problem) => problem.rule),
      )
      const distanceOf = (message: string) =>
        Number(/the home distance (\S+) lies outside/.exec(message)?.[1])
      const planDistance = distanceOf(
        problems.find((problem) => problem.rule === 'home-within-distance-limits')?.message ?? '',
      )
      const modelDistance = distanceOf(
        modelSpace.problems.find((problem) => problem.rule === 'home-within-distance-limits')
          ?.message ?? '',
      )
      expect(planDistance).toBeDefined()
      expect(planDistance).toBeCloseTo(modelDistance, 12)
    },
  )
})
