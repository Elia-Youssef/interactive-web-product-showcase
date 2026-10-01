import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import { hasUnhandledCameraRequest, selectCameraRequestChannel, type AppState } from '@store/index'
import type { StoreApi } from 'zustand/vanilla'
import type { StageCameraState } from './stageCameraApi'
import { stepZoomBy, transitionToView } from './stageCameraApi'

// The store bridge of the stage camera, both directions. Out: the live
// readouts, published as the controls update, so the chrome's readouts
// track the camera while it moves and stop tracking at rest, when the
// updates stop. In: the UI's requests from the store's camera channel,
// executed as the store receives them, one move per sequenced request, at
// rest included, where no frame would run. Every request runs through the
// stage camera's own API, the same functions the in-canvas callers use, so
// there is one move path for a view change or a zoom step.

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
  store: StoreApi<AppState>,
  state: StageCameraState,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    // The channel is the newest intent, not a backlog: requests made
    // before this mount are not waiting on it.
    let executedSequence = selectCameraRequestChannel(store.getState()).sequence
    return store.subscribe((next) => {
      const channel = selectCameraRequestChannel(next)
      if (!hasUnhandledCameraRequest(channel, executedSequence)) {
        return
      }
      executedSequence = channel.sequence
      const request = channel.request
      if (request === null) {
        return
      }
      // One channel request, one camera move, through the stage camera's
      // API. A request that outlives its product has no view to move to:
      // the channel carries the UI's newest intent, and the UI asks only
      // while readouts are live.
      const move =
        request.kind === 'view'
          ? transitionToView(state, request.viewId)
          : stepZoomBy(state, request.direction)
      // An eased move invalidates itself through its events; an instant one
      // owes the next frame itself.
      state.invalidate()
      void move
    })
  }, [controls, store, state])
}
