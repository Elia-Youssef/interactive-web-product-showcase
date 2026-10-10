import { useEffect } from 'react'
import type CameraControlsImpl from 'camera-controls'
import { Spherical } from 'three/webgpu'
import {
  hasUnhandledCameraRequest,
  selectCameraRequestChannel,
  type AppState,
  type CameraOutcomeEvent,
  type CameraRequest,
  type CameraRequestRejectionReason,
} from '@store/index'
import type { StoreApi } from 'zustand/vanilla'
import { CameraStepCoalescer, isNoStep, type FrameSchedule } from '@lib/camera/cameraStep'
import type { StageCameraState } from './stageCameraApi'
import {
  CameraNoPlanError,
  CameraUnknownViewError,
  rotateStep,
  stepZoomBy,
  transitionToView,
} from './stageCameraApi'
import { readControlsEnd } from './controls'

// The store bridge of the stage camera, both directions. Out: the live
// readouts, published as the controls update, so the chrome's readouts
// track the camera while it moves and stop tracking at rest, when the
// updates stop. In: the UI's requests from the store's camera channel. A
// view request runs as the store receives it, at rest included, where no
// frame would run. Steps (an orbit turn, zoom steps) merge per kind and run
// once per frame on the stage's frame path, so a control that repeats
// faster than the stage draws costs one move per frame, and a view request
// drops the steps still pending, since it moves the camera somewhere of its
// own. Every request runs through the stage camera's own API, the same
// functions the in-canvas callers use, so there is one move path for each
// kind; every move is awaited and its typed outcome reported with its
// request's sequence, so nothing throws into the store, and the store keeps
// the newest one.

export function useCameraReadoutPublish(
  controls: CameraControlsImpl | null,
  store: StoreApi<AppState>,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    // The end state's scratch value, created once per mount and reused by
    // every publish, so the per-update read allocates nothing.
    const scratch = new Spherical()
    const publish = () => {
      const end = readControlsEnd(controls, scratch)
      store.getState().cameraPublishReadout({
        kind: 'live',
        azimuth: controls.azimuthAngle,
        distance: controls.distance,
        endDistance: end.radius,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        endPolar: end.phi,
        minPolar: controls.minPolarAngle,
        maxPolar: controls.maxPolarAngle,
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
  stepFrame: FrameSchedule,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    return watchCameraRequests(
      store,
      (request) => {
        const move = moveOf(state, request)
        // An eased move invalidates itself through its events; an instant
        // one owes the next frame itself. The invalidate runs after the
        // move call returned, so a rejected request renders no frame.
        state.invalidate()
        return move
      },
      stepFrame,
    )
  }, [controls, store, state, stepFrame])
}

// The one move of the stage camera's API a request asks for.
function moveOf(state: StageCameraState, request: CameraRequest): Promise<void> {
  switch (request.kind) {
    case 'view':
      return transitionToView(state, request.viewId)
    case 'zoom':
      return stepZoomBy(state, request.steps)
    case 'rotate':
      return rotateStep(state, request)
  }
}

// The store side of the request channel, outside React so the outcome
// contract runs against the real store in a unit test. A view request is
// one move, run at once; steps merge per kind until the step frame the
// schedule hands out, then run as one move each. Every move is awaited and
// its outcome reported with its request's sequence (a merged step's is the
// newest it merged); a rejection is reported loudly enough for the e2e
// console gate to fail any test that hits one.
export function watchCameraRequests(
  store: StoreApi<AppState>,
  move: (request: CameraRequest) => Promise<void>,
  stepFrame: FrameSchedule,
): () => void {
  const run = (sequence: number, request: CameraRequest) =>
    runCameraRequest(
      sequence,
      request,
      () => move(request),
      (event) => store.getState().cameraRequestOutcome(event),
      (message) => console.error(message),
    )
  const steps = new CameraStepCoalescer(stepFrame, ({ sequence, step }) => {
    if (isNoStep(step)) {
      store.getState().cameraRequestOutcome({ kind: 'unchanged', sequence, request: step })
    } else {
      run(sequence, step)
    }
  })
  // The channel is the newest intent, not a backlog: requests made before
  // this mount are not waiting on it.
  let executedSequence = selectCameraRequestChannel(store.getState()).sequence
  const unsubscribe = store.subscribe((next) => {
    const channel = selectCameraRequestChannel(next)
    if (!hasUnhandledCameraRequest(channel, executedSequence)) {
      return
    }
    executedSequence = channel.sequence
    const request = channel.request
    if (request === null) {
      return
    }
    if (request.kind === 'view') {
      steps.clear()
      run(channel.sequence, request)
      return
    }
    steps.add(request, channel.sequence)
  })
  return () => {
    unsubscribe()
    steps.dispose()
  }
}

// One channel request, one camera move. The two synchronous failures of the
// move API are typed errors, so a rejection is classified by the error's
// own type, never by its message; any other synchronous throw is not a move
// failure the channel knows and stays loud. The move is awaited and its
// outcome reported once. Superseded moves included: camera-controls
// resolves every superseded promise at the same final rest, so two
// overlapping requests both report arrived, and the store keeps the
// newer one's.
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
    report({ kind: 'rejected', sequence, request, reason })
    reportRejection(
      `the camera request #${sequence} ${describeCameraRequest(request)} was rejected: ${reason}`,
    )
    return
  }
  void pending.then(() => report({ kind: 'arrived', sequence, request }))
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
  switch (request.kind) {
    case 'view':
      return `view '${request.viewId}'`
    case 'zoom':
      return 'a zoom step'
    case 'rotate':
      return 'an orbit turn'
  }
}
