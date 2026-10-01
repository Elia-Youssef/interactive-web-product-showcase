import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import type { RefObject } from 'react'
import {
  hasUnhandledCameraRequest,
  selectCameraRequestChannel,
  type CameraRequest,
  type AppState,
} from '@store/index'
import type { StoreApi } from 'zustand/vanilla'
import { PerspectiveCamera, type Camera } from 'three'
import type { CameraPlan } from './productPlan'
import { applyView, scaledRangeOf, stepZoom, viewOfPlan } from './controls'
import { prefersReducedMotion } from './prefersReducedMotion'

// The store bridge of the stage camera, both directions. Out: the live
// readouts, published as the controls update, so the chrome's readouts
// track the camera while it moves and stop tracking at rest, when the
// updates stop. In: the UI's requests from the store's camera channel,
// executed as the store receives them, one move per sequenced request, at
// rest included, where no frame would run.

export function useCameraReadoutPublish(
  controls: CameraControlsImpl | null,
  store: StoreApi<AppState>,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    const publish = () => {
      store.getState().cameraPublishReadout({
        kind: 'live',
        azimuth: controls.azimuthAngle,
        distance: controls.distance,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      })
    }
    controls.addEventListener('update', publish)
    return () => controls.removeEventListener('update', publish)
  }, [controls, store])
}

export function useCameraRequests(
  controls: CameraControlsImpl | null,
  camera: Camera,
  store: StoreApi<AppState>,
  planRef: RefObject<CameraPlan | null>,
  stageAspect: () => number,
  invalidate: () => void,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    // The channel is the newest intent, not a backlog: requests made
    // before this mount are not waiting on it.
    let executedSequence = selectCameraRequestChannel(store.getState()).sequence
    return store.subscribe((state) => {
      const channel = selectCameraRequestChannel(state)
      if (!hasUnhandledCameraRequest(channel, executedSequence)) {
        return
      }
      executedSequence = channel.sequence
      const request = channel.request
      if (request === null) {
        return
      }
      executeCameraRequest(request, camera, planRef, controls, stageAspect, invalidate)
    })
  }, [controls, camera, store, planRef, stageAspect, invalidate])
}

// One channel request, one camera move. A request that outlives its
// product has no view to move to and nothing to move: the channel carries
// the UI's newest intent, and the UI asks only while readouts are live.
function executeCameraRequest(
  request: CameraRequest,
  camera: Camera,
  planRef: RefObject<CameraPlan | null>,
  controls: CameraControlsImpl,
  stageAspect: () => number,
  invalidate: () => void,
): void {
  const plan = planRef.current
  if (plan === null) {
    return
  }
  if (!(camera instanceof PerspectiveCamera)) {
    throw new Error('the stage camera presents the perspective camera R3F provides by default')
  }
  const enableTransition = !prefersReducedMotion()
  if (request.kind === 'view') {
    void applyView(
      controls,
      camera,
      plan,
      viewOfPlan(plan, request.viewId),
      stageAspect(),
      enableTransition,
    )
  } else {
    void stepZoom(controls, scaledRangeOf(plan, stageAspect()), request.direction, enableTransition)
  }
  // An eased move invalidates itself through its events; an instant one
  // owes the next frame itself.
  invalidate()
}
