import { tiltLimitOf, type TiltLimit } from '@lib/camera/orbitStep'
import { zoomLimitOf, type ZoomLimit } from '@lib/camera/zoom'
import { CAMERA_HOME_ID } from '@lib/product/contractNames'
import {
  applyCameraOutcomeEvent,
  applyCameraReadoutEvent,
  initialCameraOutcome,
  initialCameraReadout,
  initialCameraRequestChannel,
  nextCameraRequest,
  type CameraOutcomeEvent,
  type CameraOutcomeRecord,
  type CameraReadout,
  type CameraReadoutEvent,
  type CameraRequest,
  type CameraRequestChannel,
} from './camera.logic'

export type {
  CameraOutcomeEvent,
  CameraOutcomeRecord,
  CameraReadout,
  CameraReadoutEvent,
  CameraRequest,
  CameraRequestChannel,
  CameraRequestOutcome,
  CameraRequestRejectionReason,
  LiveCameraReadout,
} from './camera.logic'
export { hasUnhandledCameraRequest } from './camera.logic'

export type CameraSliceState = {
  cameraReadout: CameraReadout
  cameraRequestChannel: CameraRequestChannel
  cameraOutcome: CameraOutcomeRecord | null
}

export type CameraSlice = CameraSliceState & {
  cameraPublishReadout: (event: CameraReadoutEvent) => void
  cameraRequest: (request: CameraRequest) => void
  cameraRequestOutcome: (event: CameraOutcomeEvent) => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetCameraState = (updater: (state: CameraSliceState) => Partial<CameraSliceState>) => void

export function createCameraSlice(set: SetCameraState): CameraSlice {
  return {
    cameraReadout: initialCameraReadout,
    cameraRequestChannel: initialCameraRequestChannel,
    cameraOutcome: initialCameraOutcome,
    cameraPublishReadout: (event) => {
      set((state) => ({ cameraReadout: applyCameraReadoutEvent(state.cameraReadout, event) }))
    },
    cameraRequest: (request) => {
      set((state) => ({
        cameraRequestChannel: nextCameraRequest(state.cameraRequestChannel, request),
      }))
    },
    cameraRequestOutcome: (event) => {
      set((state) => ({ cameraOutcome: applyCameraOutcomeEvent(state.cameraOutcome, event) }))
    },
  }
}

export function selectCameraReadout(state: CameraSliceState): CameraReadout {
  return state.cameraReadout
}

export function selectCameraRequestChannel(state: CameraSliceState): CameraRequestChannel {
  return state.cameraRequestChannel
}

export function selectCameraOutcome(state: CameraSliceState): CameraOutcomeRecord | null {
  return state.cameraOutcome
}

// Whether a product view is presented: the camera readout is live.
export function selectCameraLive(state: CameraSliceState): boolean {
  return state.cameraReadout.kind === 'live'
}

// The zoom limit the camera's move ends at, or null inside the range and
// while no view is presented. A primitive, so a subscriber re-renders when
// the limit changes, not on every frame of a move.
export function selectZoomLimit(state: CameraSliceState): ZoomLimit | null {
  const readout = state.cameraReadout
  return readout.kind === 'live'
    ? zoomLimitOf(readout.endDistance, { min: readout.minDistance, max: readout.maxDistance })
    : null
}

// The tilt limit the camera's move ends at, the same way.
export function selectTiltLimit(state: CameraSliceState): TiltLimit | null {
  const readout = state.cameraReadout
  return readout.kind === 'live'
    ? tiltLimitOf(readout.endPolar, { min: readout.minPolar, max: readout.maxPolar })
    : null
}

// The sequence of the newest settled request when it brought the camera to
// the home view, or null when the newest settled request is any other.
export function selectHomeArrival(state: CameraSliceState): number | null {
  const record = state.cameraOutcome
  return record !== null &&
    record.outcome.kind === 'arrived' &&
    record.request.kind === 'view' &&
    record.request.viewId === CAMERA_HOME_ID
    ? record.sequence
    : null
}
