// The camera readout and the request channel as pure state transitions, one
// event at a time. The readout is what the chrome shows, the request
// channel is what the UI asks the camera to do. Exact values only:
// normalization and formatting of the azimuth and the zoom percentage
// belong to the layers that display them.

import type { CameraStep } from '@lib/camera/cameraStep'

// The live camera readout of the stage: idle while no product view is
// presented, live with the controls' own values once one is. The azimuth is
// the controls' accumulated angle in radians, so full turns survive in the
// exact value and the display normalizes them. The distances are in stage
// units at the current stage aspect, the same values the controls enforce.
// The end distance is where the current transition ends, or the live
// distance at rest: the state a zoom step reads and clamps. The controls
// rest within their own threshold of that end, so the live distance sits a
// hair short of it while the move dies out; a limit the controls reached is
// exact in the end distance and only near in the live one. The end polar
// angle is the same for the tilt: where the current move ends, in radians
// from straight up, held exactly at the polar limits it is clamped to.
export type CameraReadout =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'live'
      readonly azimuth: number
      readonly distance: number
      readonly endDistance: number
      readonly minDistance: number
      readonly maxDistance: number
      readonly endPolar: number
      readonly minPolar: number
      readonly maxPolar: number
    }

export type LiveCameraReadout = Extract<CameraReadout, { kind: 'live' }>

// One request from the UI to the camera: show a view by id, or a step
// relative to where the current move ends: a turn of the orbit, or zoom
// steps toward the product (positive) or away from it (negative).
export type CameraRequest = { readonly kind: 'view'; readonly viewId: string } | CameraStep

// The request channel: the newest request and its sequence number. The
// sequence makes the same request twice run twice, because the second one
// carries a higher sequence than the one the camera last executed.
export type CameraRequestChannel = {
  readonly sequence: number
  readonly request: CameraRequest | null
}

// The events the camera reports of itself.
export type CameraReadoutEvent =
  ({ readonly kind: 'live' } & Omit<LiveCameraReadout, 'kind'>) | { readonly kind: 'idle' }

export const initialCameraReadout: CameraReadout = { kind: 'idle' }

export const initialCameraRequestChannel: CameraRequestChannel = { sequence: 0, request: null }

// Pure transition from (readout, event) to the next readout. A live event
// whose values equal the current ones returns the same readout object, so
// the store keeps its identity and subscribers see no change.
export function applyCameraReadoutEvent(
  readout: CameraReadout,
  event: CameraReadoutEvent,
): CameraReadout {
  switch (event.kind) {
    case 'idle':
      return readout.kind === 'idle' ? readout : initialCameraReadout
    case 'live': {
      const live: LiveCameraReadout = {
        kind: 'live',
        azimuth: event.azimuth,
        distance: event.distance,
        endDistance: event.endDistance,
        minDistance: event.minDistance,
        maxDistance: event.maxDistance,
        endPolar: event.endPolar,
        minPolar: event.minPolar,
        maxPolar: event.maxPolar,
      }
      return sameLiveReadout(readout, live) ? readout : live
    }
  }
}

function sameLiveReadout(a: CameraReadout, b: LiveCameraReadout): boolean {
  return (
    a.kind === 'live' &&
    a.azimuth === b.azimuth &&
    a.distance === b.distance &&
    a.endDistance === b.endDistance &&
    a.minDistance === b.minDistance &&
    a.maxDistance === b.maxDistance &&
    a.endPolar === b.endPolar &&
    a.minPolar === b.minPolar &&
    a.maxPolar === b.maxPolar
  )
}

// The channel after one more request: the sequence grows by one, so the
// camera executes this request even when it repeats the one before it.
export function nextCameraRequest(
  channel: CameraRequestChannel,
  request: CameraRequest,
): CameraRequestChannel {
  return { sequence: channel.sequence + 1, request }
}

// Whether the channel holds a request the camera has not executed yet,
// judged against the highest sequence the camera has executed.
export function hasUnhandledCameraRequest(
  channel: CameraRequestChannel,
  executedSequence: number,
): boolean {
  return channel.request !== null && channel.sequence > executedSequence
}

// The reason a camera request was rejected: one of the typed failures of
// the stage camera's move API. No presented plan to move with, a view id
// the presented plan does not hold, or a move that failed after it
// started.
export type CameraRequestRejectionReason = 'no-plan' | 'unknown-view' | 'move-failed'

// The outcome of one camera request: the move came to rest, the merged
// steps required no move, the request was rejected before a move began or
// failed after it started, or the watcher generation that owed it ended
// before it settled, which answers the request for good: no generation
// re-executes it, and no later report can arrive for it.
export type CameraRequestOutcome =
  | { readonly kind: 'arrived' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'retired' }
  | { readonly kind: 'rejected'; readonly reason: CameraRequestRejectionReason }

// The outcome of the newest request the camera has settled: its sequence,
// the request itself, and how it ended. The channel holds the newest
// intent, not a backlog, and the record answers for the same intent: a
// request a newer one has already settled past is history no reader acts
// on, so the record is one entry whatever the number of requests, and a
// held key that asks once per frame costs nothing to keep. A rejection is
// reported loudly when it happens as well (the bridge), so no failure
// depends on being read here.
export type CameraOutcomeRecord = {
  readonly sequence: number
  readonly request: CameraRequest
  readonly outcome: CameraRequestOutcome
}

export type CameraOutcomeEvent =
  | {
      readonly kind: 'arrived' | 'unchanged' | 'retired'
      readonly sequence: number
      readonly request: CameraRequest
    }
  | {
      readonly kind: 'rejected'
      readonly sequence: number
      readonly request: CameraRequest
      readonly reason: CameraRequestRejectionReason
    }

export const initialCameraOutcome: CameraOutcomeRecord | null = null

// Pure transition from (record, event) to the next record. A report for a
// sequence below the recorded one changes nothing: overlapping moves all
// resolve at the same final rest, in no promised order, so the newest
// request's outcome stands whichever report comes last. A repeated write
// for the recorded sequence replaces its outcome.
export function applyCameraOutcomeEvent(
  record: CameraOutcomeRecord | null,
  event: CameraOutcomeEvent,
): CameraOutcomeRecord | null {
  if (record !== null && event.sequence < record.sequence) {
    return record
  }
  return {
    sequence: event.sequence,
    request: event.request,
    outcome:
      event.kind === 'rejected' ? { kind: 'rejected', reason: event.reason } : { kind: event.kind },
  }
}
