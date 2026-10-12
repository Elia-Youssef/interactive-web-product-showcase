// The one-space rule of the camera plan: the plan checks in stage space
// (the rays read after centering, the center at the stage origin), and the
// same check over the model-space facts must agree, because the geometry is
// translation invariant. A check that read the ray in one space and the
// center in another disagrees by the dot product of center and forward,
// which is what the off-origin, pitched-camera table catches.
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'
import { cameraContractProblems } from '@lib/camera/contract'
import { cameraLimitConfig } from '@lib/camera/config'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import { buildCameraPlan } from './productPlan'
import { brokenProblems, manifestWith, mountedTree, rigWith } from './productPlanFixtures'

// A frame whose center sits at the given model-space point.
function frameAt(center: [number, number, number]): ModelFrame {
  return {
    centerX: center[0],
    centerY: center[1],
    centerZ: center[2],
    radius: 0.4,
    meshes: 1,
    triangles: 12,
    min: [center[0] - 0.4, center[1] - 0.4, center[2] - 0.4],
    max: [center[0] + 0.4, center[1] + 0.4, center[2] + 0.4],
  }
}

// The problems the plan build reports for the given manifest camera block.
function planProblems(
  rig: ProductRig,
  modelFrame: ModelFrame,
  camera: { minDistance?: number; maxDistance?: number },
) {
  return brokenProblems(buildCameraPlan(rig, manifestWith(camera), modelFrame))
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
        product: 'sample-one',
        views: [{ id: 'home', ray, pivot: { point: center, subject: 'the model center' } }],
        homeId: 'home',
        bounds: { min: modelFrame.min, max: modelFrame.max },
        explodedBounds: null,
        authoredDistanceLimits: cameraBlock,
        limits: cameraLimitConfig,
      })

      const modelProblems = modelSpace.kind === 'broken' ? modelSpace.problems : []
      expect(problems.map((problem) => problem.rule)).toEqual(
        modelProblems.map((problem) => problem.rule),
      )
      const distanceOf = (message: string) =>
        Number(/the CAM_home distance (\S+) lies outside/.exec(message)?.[1])
      const planDistance = distanceOf(
        problems.find((problem) => problem.rule === 'view-within-distance-limits')?.message ?? '',
      )
      const modelDistance = distanceOf(
        modelProblems.find((problem) => problem.rule === 'view-within-distance-limits')?.message ??
          '',
      )
      expect(planDistance).toBeDefined()
      expect(planDistance).toBeCloseTo(modelDistance, 12)
    },
  )
})
