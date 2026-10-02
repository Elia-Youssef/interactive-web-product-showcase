import {
  applyCameraOutcomeEvent,
  applyCameraReadoutEvent,
  initialCameraOutcomes,
  initialCameraReadout,
  initialCameraRequestChannel,
  nextCameraRequest,
  type CameraOutcomeEvent,
  type CameraOutcomes,
  type CameraReadout,
  type CameraReadoutEvent,
  type CameraRequest,
  type CameraRequestChannel,
} from './camera.logic'

export type {
  CameraOutcomeEvent,
  CameraOutcomes,
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
  cameraOutcomes: CameraOutcomes
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
    cameraOutcomes: initialCameraOutcomes,
    cameraPublishReadout: (event) => {
      set((state) => ({ cameraReadout: applyCameraReadoutEvent(state.cameraReadout, event) }))
    },
    cameraRequest: (request) => {
      set((state) => ({
        cameraRequestChannel: nextCameraRequest(state.cameraRequestChannel, request),
      }))
    },
    cameraRequestOutcome: (event) => {
      set((state) => ({ cameraOutcomes: applyCameraOutcomeEvent(state.cameraOutcomes, event) }))
    },
  }
}

export function selectCameraReadout(state: CameraSliceState): CameraReadout {
  return state.cameraReadout
}

export function selectCameraRequestChannel(state: CameraSliceState): CameraRequestChannel {
  return state.cameraRequestChannel
}

export function selectCameraOutcomes(state: CameraSliceState): CameraOutcomes {
  return state.cameraOutcomes
}
