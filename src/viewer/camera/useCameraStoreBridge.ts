import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import { Spherical } from 'three'
import {
  hasUnhandledCameraRequest,
  selectCameraRequestChannel,
  type AppState,
  type CameraOutcomeEvent,
  type CameraRequest,
  type CameraRequestRejectionReason,
} from '@store/index'
import type { StoreApi } from 'zustand/vanilla'
import type { StageCameraState } from './stageCameraApi'
import {
  CameraNoPlanError,
  CameraUnknownViewError,
  stepZoomBy,
  transitionToView,
} from './stageCameraApi'
import { readControlsEndDistance } from './controls'

// The store bridge of the stage camera, both directions. Out: the live
// readouts, published as the controls update, so the chrome's readouts
// track the camera while it moves and stop tracking at rest, when the
// updates stop. In: the UI's requests from the store's camera channel,
// executed as the store receives them, one move per sequenced request, at
// rest included, where no frame would run. Every request runs through the
// stage camera's own API, the same functions the in-canvas callers use, so
// there is one move path for a view change or a zoom step; every move is
// awaited and its typed outcome recorded against the request's sequence,
// so nothing is dropped and nothing throws into the store.

export function useCameraReadoutPublish(
  controls: CameraControlsImpl | null,
  store: StoreApi<AppState>,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    // The end distance's scratch value, created once per mount and reused
    // by every publish, so the per-update read allocates nothing.
    const scratch = new Spherical()
    const publish = () => {
      store.getState().cameraPublishReadout({
        kind: 'live',
        azimuth: controls.azimuthAngle,
        distance: controls.distance,
        endDistance: readControlsEndDistance(controls, scratch),
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
    return watchCameraRequests(store, (request) => {
      const move =
        request.kind === 'view'
          ? transitionToView(state, request.viewId)
          : stepZoomBy(state, request.direction)
      // An eased move invalidates itself through its events; an instant one
      // owes the next frame itself. The invalidate runs after the move call
      // returned, so a rejected request renders no frame.
      state.invalidate()
      return move
    })
  }, [controls, store, state])
}

// The store side of the request channel, outside React so the outcome
// contract runs against the real store in a unit test. One move per
// sequenced request, awaited, its outcome recorded against the request's
// sequence; a rejection is reported loudly enough for the e2e console gate
// to fail any test that hits one.
export function watchCameraRequests(
  store: StoreApi<AppState>,
  move: (request: CameraRequest) => Promise<void>,
): () => void {
  // The channel is the newest intent, not a backlog: requests made before
  // this mount are not waiting on it.
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
    runCameraRequest(
      channel.sequence,
      request,
      () => move(request),
      (event) => store.getState().cameraRequestOutcome(event),
      (message) => console.error(message),
    )
  })
}

// One channel request, one camera move. The two synchronous failures of the
// move API are typed errors, so a rejection is classified by the error's
// own type, never by its message; any other synchronous throw is not a move
// failure the channel knows and stays loud. The move is awaited and its
// outcome reported once. Superseded moves included: camera-controls
// resolves every superseded promise at the same final rest, so two
// overlapping requests both record arrived.
export function runCameraRequest(
  sequence: number,
  request: CameraRequest,
  move: () => Promise<void>,
  report: (event: CameraOutcomeEvent) => void,
  reportRejection: (message: string) => void,
): void {
  let pending: Promise<void>
  try {
    pending = move()
  } catch (error) {
    const reason = rejectionReasonOf(error)
    if (reason === null) {
      throw error
    }
    report({ kind: 'rejected', sequence, reason })
    reportRejection(
      `the camera request #${sequence} ${describeCameraRequest(request)} was rejected: ${reason}`,
    )
    return
  }
  void pending.then(() => report({ kind: 'arrived', sequence }))
}

// The rejection reason of a move failure, or null when the error is not one
// of the two typed move failures.
export function rejectionReasonOf(error: unknown): CameraRequestRejectionReason | null {
  if (error instanceof CameraNoPlanError) {
    return 'no-plan'
  }
  if (error instanceof CameraUnknownViewError) {
    return 'unknown-view'
  }
  return null
}

function describeCameraRequest(request: CameraRequest): string {
  return request.kind === 'view' ? `view '${request.viewId}'` : 'a zoom step'
}
