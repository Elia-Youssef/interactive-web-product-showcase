import type { CameraControlsImpl } from '@react-three/drei'
import type { RefObject } from 'react'
import { PerspectiveCamera, type Camera } from 'three'
import type { DistanceRange } from '@lib/camera/limits'
import type { CameraPlan } from './productPlan'
import { applyLens, applyView, scaledRangeOf, stepZoom, viewOfPlan } from './controls'
import { prefersReducedMotion } from './prefersReducedMotion'

// The four camera operations the context API hands out, as plain functions
// over the stage camera's live state. Each one requires the controls and
// the perspective camera it needs and fails loudly when they are not there;
// the state is read at call time, so the functions never see a stale plan
// or aspect.

export type StageCameraState = {
  // The controls once drei mounted them, null before that.
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
    throw new Error('no product view is presented to move the stage camera with')
  }
  return plan
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
// Resolves when the controls reach rest.
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
