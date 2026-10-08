// The camera readout and the request channel as pure state transitions, one
// event at a time. The readout is what the chrome shows, the request
// channel is what the UI asks the camera to do. Exact values only:
// normalization and formatting of the azimuth and the zoom percentage
// belong to the layers that display them.

// The live camera readout of the stage: idle while no product view is
// presented, live with the controls' own values once one is. The azimuth is
// the controls' accumulated angle in radians, so full turns survive in the
// exact value and the display normalizes them. The distances are in stage
// units at the current stage aspect, the same values the controls enforce.
// The end distance is where the current transition ends, or the live
// distance at rest: the state a zoom step reads and clamps. The controls
// rest within their own threshold of that end, so the live distance sits a
// hair short of it while the move dies out; a limit the controls reached is
// exact in the end distance and only near in the live one.
export type CameraReadout =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'live'
      readonly azimuth: number
      readonly distance: number
      readonly endDistance: number
      readonly minDistance: number
      readonly maxDistance: number
    }

export type LiveCameraReadout = Extract<CameraReadout, { kind: 'live' }>

// One request from the UI to the camera: show a view by id, or step the
// zoom toward the product (1) or away from it (-1).
export type CameraRequest =
  | { readonly kind: 'view'; readonly viewId: string }
  | { readonly kind: 'zoom'; readonly direction: 1 | -1 }

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
    a.maxDistance === b.maxDistance
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

// The reason a camera request was rejected: one of the two synchronous
// failures of the stage camera's move API. No presented plan to move with,
// or a view id the presented plan does not hold.
export type CameraRequestRejectionReason = 'no-plan' | 'unknown-view'

// The outcome of one camera request: the move came to rest, or the request
// was rejected before any move began.
export type CameraRequestOutcome =
  | { readonly kind: 'arrived' }
  | { readonly kind: 'rejected'; readonly reason: CameraRequestRejectionReason }

// The outcomes of the requests the camera has executed, keyed by the
// request's sequence. One sequence holds one outcome: its move either comes
// to rest or is rejected, never both.
export type CameraOutcomes = ReadonlyMap<number, CameraRequestOutcome>

export type CameraOutcomeEvent =
  | { readonly kind: 'arrived'; readonly sequence: number }
  | {
      readonly kind: 'rejected'
      readonly sequence: number
      readonly reason: CameraRequestRejectionReason
    }

export const initialCameraOutcomes: CameraOutcomes = new Map()

// Pure transition from (outcomes, event) to the next outcomes. The bridge
// records one event per request, so a sequence is written once; a repeated
// write for a sequence replaces its outcome, and the newest value is the
// one a reader sees.
export function applyCameraOutcomeEvent(
  outcomes: CameraOutcomes,
  event: CameraOutcomeEvent,
): CameraOutcomes {
  const next = new Map(outcomes)
  next.set(
    event.sequence,
    event.kind === 'arrived' ? { kind: 'arrived' } : { kind: 'rejected', reason: event.reason },
  )
  return next
}
