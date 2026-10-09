import type CameraControlsImpl from 'camera-controls'
import type { RefObject } from 'react'
import { PerspectiveCamera, type Camera } from 'three/webgpu'
import type { DistanceRange } from '@lib/camera/limits'
import type { CameraPlan, CameraView } from './productPlan'
import { applyLens, applyView, scaledRangeOf, stepZoom } from './controls'
import { prefersReducedMotion } from '@lib/motion/reducedMotion'

// The four camera operations the context API hands out, as plain functions
// over the stage camera's live state. Each one requires the controls and
// the perspective camera it needs and fails loudly when they are not there;
// the state is read at call time, so the functions never see a stale plan
// or aspect.

export type StageCameraState = {
  // The controls while the stage has mounted them, null before that.
  readonly controls: CameraControlsImpl | null
  // The stage's camera, which the lens is applied to.
  readonly camera: Camera
  // The plan of the presented product, or null while none is.
  readonly planRef: RefObject<CameraPlan | null>
  // The distance range the controls' limits hold right now, in stage units
  // at the aspect they were applied at.
  readonly appliedRangeRef: RefObject<DistanceRange | null>
  // The stage aspect at call time.
  readonly stageAspect: () => number
  readonly invalidate: () => void
}

// The two synchronous failures of a move request, as typed errors: the
// store bridge classifies a rejection by the error's own type, never by its
// message, and any other throw is not a move failure the channel knows.
export class CameraNoPlanError extends Error {
  constructor() {
    super('no product view is presented to move the stage camera with')
    this.name = 'CameraNoPlanError'
  }
}

export class CameraUnknownViewError extends Error {
  constructor(viewId: string) {
    super(`the presented camera plan holds no view '${viewId}'`)
    this.name = 'CameraUnknownViewError'
  }
}

function requireControls(state: StageCameraState): CameraControlsImpl {
  if (state.controls === null) {
    throw new Error('the stage camera is not mounted yet')
  }
  return state.controls
}

function requirePerspectiveCamera(state: StageCameraState): PerspectiveCamera {
  if (!(state.camera instanceof PerspectiveCamera)) {
    throw new Error('the stage camera presents the perspective camera R3F provides by default')
  }
  return state.camera
}

function requirePlan(state: StageCameraState): CameraPlan {
  const plan = state.planRef.current
  if (plan === null) {
    throw new CameraNoPlanError()
  }
  return plan
}

// The view of the plan a view id names. The one resolution every caller
// shares: a view the plan does not hold throws CameraUnknownViewError
// before anything changes.
function viewOfPlan(plan: CameraPlan, viewId: string): CameraView {
  const view = plan.views.get(viewId)
  if (view === undefined) {
    throw new CameraUnknownViewError(viewId)
  }
  return view
}

// Registers the plan and shows one of its views at once, with no
// transition: the product presentation calls this before ready, so the
// first presented frame is already the home view. The plan's base lens and
// clip range go on the camera once here, and the home view itself presents
// at the zoom 1 its lens maps to. The view id is resolved before anything
// changes, so a wrong id changes nothing.
export function presentPlan(state: StageCameraState, plan: CameraPlan, viewId: string): void {
  const view = viewOfPlan(plan, viewId)
  const controls = requireControls(state)
  const perspectiveCamera = requirePerspectiveCamera(state)
  state.planRef.current = plan
  state.appliedRangeRef.current = scaledRangeOf(plan, state.stageAspect())
  controls.enabled = true
  applyLens(perspectiveCamera, plan)
  void applyView(controls, plan, view, state.stageAspect(), false)
  state.invalidate()
}

// Eases to one of the plan's views, or moves at once under reduced motion.
// Resolves when the controls reach rest. The view is resolved before
// anything changes: a view the plan does not hold throws
// CameraUnknownViewError and moves nothing.
export function transitionToView(state: StageCameraState, viewId: string): Promise<void> {
  const plan = requirePlan(state)
  return applyView(
    requireControls(state),
    plan,
    viewOfPlan(plan, viewId),
    state.stageAspect(),
    !prefersReducedMotion(),
  )
}

// Steps the zoom one configured step toward the product or away from it,
// eased like a transition, and resolves at rest.
export function stepZoomBy(state: StageCameraState, direction: 1 | -1): Promise<void> {
  const plan = requirePlan(state)
  return stepZoom(
    requireControls(state),
    scaledRangeOf(plan, state.stageAspect()),
    direction,
    !prefersReducedMotion(),
  )
}

// Ends the presentation: the plan is dropped, the controls stop listening,
// and the readouts go idle.
export function releasePresentation(state: StageCameraState, publishIdle: () => void): void {
  state.planRef.current = null
  state.appliedRangeRef.current = null
  if (state.controls !== null) {
    state.controls.enabled = false
  }
  publishIdle()
}
