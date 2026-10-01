import type { CameraControlsImpl } from '@react-three/drei'
import { z } from 'zod'
import { MathUtils, type PerspectiveCamera } from 'three'
import { containedDistanceScale } from '@lib/camera/aspect'
import { orbitAnglesOf, positionOfOrbitAngles } from '@lib/camera/view'
import type { Vec3 } from '@lib/camera/view'
import { distanceOfZoomPercent, steppedZoomPercent, zoomPercentOfDistance } from '@lib/camera/zoom'
import type { DistanceRange } from '@lib/camera/limits'
import { stageCameraConfig } from './config'
import type { CameraPlan, CameraView } from './productPlan'

// The controls-level operations of the stage camera, one move each. Every
// function takes the controls, the plan or view to act on, and the stage
// aspect, and does no React and no store work: the component and its hooks
// wire these into their lifecycles.

// The end state of the controls, as their own toJSON reports it: the orbit
// target and the camera position the current transition is moving toward.
// The live getters lag an eased move, and the zoom buttons must step from
// where the move ends, so the buttons read the end state, the one state
// that makes the same request twice run twice.
const controlsEndStateSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
})

export type ControlsEndState = {
  readonly position: Vec3
  readonly target: Vec3
}

export function readControlsEndState(controls: CameraControlsImpl): ControlsEndState {
  const end = controlsEndStateSchema.parse(JSON.parse(controls.toJSON()))
  return { position: end.position, target: end.target }
}

// The distance limits of a plan at one stage aspect, by the aspect rule:
// every distance scales by the same factor, so the zoom percentage is the
// same at any aspect.
export function scaledRangeOf(plan: CameraPlan, stageAspect: number): DistanceRange {
  const scale = containedDistanceScale(plan.authoredAspect, stageAspect)
  return {
    min: plan.distanceRange.min * scale,
    max: plan.distanceRange.max * scale,
  }
}

export function viewOfPlan(plan: CameraPlan, viewId: string): CameraView {
  const view = plan.views.get(viewId)
  if (view === undefined) {
    throw new Error(`the presented camera plan holds no view '${viewId}'`)
  }
  return view
}

// The authored lens of the view: Blender owns camera views, so the stage
// camera takes the authored vertical fov and near and far planes.
export function applyLens(camera: PerspectiveCamera, view: CameraView): void {
  camera.fov = MathUtils.radToDeg(view.fovY)
  camera.near = view.near
  camera.far = view.far
  camera.updateProjectionMatrix()
}

// Puts the controls' limits in place and moves the camera onto the view at
// the stage's aspect scale. With a transition the controls ease there and
// the promise resolves at rest; without one they arrive at once.
export function applyView(
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
  plan: CameraPlan,
  view: CameraView,
  stageAspect: number,
  enableTransition: boolean,
): Promise<void> {
  applyLens(camera, view)
  const range = scaledRangeOf(plan, stageAspect)
  controls.minDistance = range.min
  controls.maxDistance = range.max
  controls.minPolarAngle = plan.polarRange.min
  controls.maxPolarAngle = plan.polarRange.max
  const scale = containedDistanceScale(plan.authoredAspect, stageAspect)
  const angles = orbitAnglesOf(view.position, view.target)
  const position = positionOfOrbitAngles(
    angles.azimuth,
    angles.polar,
    angles.distance * scale,
    view.target,
  )
  return controls.setLookAt(
    position[0],
    position[1],
    position[2],
    view.target[0],
    view.target[1],
    view.target[2],
    enableTransition,
  )
}

// One zoom button step from the end distance, clamped by the percentage
// math to the limits.
export function stepZoom(
  controls: CameraControlsImpl,
  range: DistanceRange,
  direction: 1 | -1,
  enableTransition: boolean,
): Promise<void> {
  const end = readControlsEndState(controls)
  const percent = zoomPercentOfDistance(orbitAnglesOf(end.position, end.target).distance, range)
  const stepped = steppedZoomPercent(percent, direction, stageCameraConfig.zoomStepPercent)
  return controls.dollyTo(distanceOfZoomPercent(stepped, range), enableTransition)
}
