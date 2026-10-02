import type { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, Vector3, type PerspectiveCamera } from 'three'
import { containedDistanceScale } from '@lib/camera/aspect'
import { zoomOfLens } from '@lib/camera/lens'
import { orbitAnglesOf, positionOfOrbitAngles } from '@lib/camera/view'
import type { OrbitAngles } from '@lib/camera/view'
import { distanceOfZoomPercent, steppedZoomPercent, zoomPercentOfDistance } from '@lib/camera/zoom'
import type { DistanceRange } from '@lib/camera/limits'
import { stageCameraConfig } from './config'
import type { CameraPlan, CameraView } from './productPlan'

// The controls-level operations of the stage camera, one move each. Every
// function takes the controls, the plan or view to act on, and the stage
// aspect, and does no React and no store work: the component and its hooks
// wire these into their lifecycles.

// The end state of the controls through their public getters: the orbit
// angles of the camera position and target the current transition is
// moving toward. The live getters lag an eased move, and the zoom buttons
// must step from where the move ends, so the steps read the end state, the
// one state that makes the same request twice run twice. receiveEndValue
// is the public getters' own default (camera-controls dist/index.d.ts),
// spelled out in the call so the read's meaning stays in it.
export function readControlsEndOrbit(controls: CameraControlsImpl): OrbitAngles {
  const position = controls.getPosition(new Vector3(), true)
  const target = controls.getTarget(new Vector3(), true)
  return orbitAnglesOf([position.x, position.y, position.z], [target.x, target.y, target.z])
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

// The lens the plan presents once, when it is presented: the plan's base
// lens and the one clip range of all its views. The views themselves never
// touch the lens: each rides the controls' zoom channel (see applyView), so
// the lens eases with the pose under one damping instead of jumping on the
// first frame.
export function applyLens(camera: PerspectiveCamera, plan: CameraPlan): void {
  camera.fov = MathUtils.radToDeg(plan.baseFovY)
  camera.near = plan.clipRange.near
  camera.far = plan.clipRange.far
  camera.updateProjectionMatrix()
}

// Puts the controls' limits in place and moves the camera onto the view at
// the stage's aspect scale, the view's lens riding the controls' own zoom
// channel as the zoom that turns the plan's base lens into the view's. With
// a transition both ease there under the same smooth time and the promise
// resolves when both have arrived, which is the same rest; without one they
// arrive at once.
export function applyView(
  controls: CameraControlsImpl,
  plan: CameraPlan,
  view: CameraView,
  stageAspect: number,
  enableTransition: boolean,
): Promise<void> {
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
  const pose = controls.setLookAt(
    position[0],
    position[1],
    position[2],
    view.target[0],
    view.target[1],
    view.target[2],
    enableTransition,
  )
  const lens = controls.zoomTo(zoomOfLens(plan.baseFovY, view.fovY), enableTransition)
  return Promise.all([pose, lens]).then(() => undefined)
}

// One zoom button step from the end distance, clamped by the percentage
// math to the limits.
export function stepZoom(
  controls: CameraControlsImpl,
  range: DistanceRange,
  direction: 1 | -1,
  enableTransition: boolean,
): Promise<void> {
  const percent = zoomPercentOfDistance(readControlsEndOrbit(controls).distance, range)
  const stepped = steppedZoomPercent(percent, direction, stageCameraConfig.zoomStepPercent)
  return controls.dollyTo(distanceOfZoomPercent(stepped, range), enableTransition)
}
