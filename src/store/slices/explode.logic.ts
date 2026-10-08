import { checkExplodeT } from '@lib/explode'

// The exploded view as a small state machine, one event at a time. Every
// event names the product it belongs to, because one store is shared by
// every product: an unnamed toggle would open the next product's view, and
// a teardown for the wrong product would close the wrong view.

// The status while no product presents a view.
export type IdleExplodeStatus = { kind: 'idle' }

// One presented product's view: the target progress the feature drives the
// clip toward (0 or 1 from the toggle, any progress in [0, 1] from the
// scrub control). The target is the one stored fact of the view: the
// state its toggle announces is derived from the same target
// (explodeViewOf), so the announced state can never disagree with what the
// controls act on. The live progress of the motion is the feature driver's
// own reading, never this state: the store holds what was asked for, not
// where the clip is. The status exists only while the product is attached,
// and a view that is not attached cannot move.
export type ActiveExplodeStatus = {
  kind: 'active'
  product: string
  target: number
}

export type ExplodeStatus = IdleExplodeStatus | ActiveExplodeStatus

export const initialExplodeStatus: ExplodeStatus = { kind: 'idle' }

// The target progress of one product's view, 0 while that product has no
// attached view: an unattached product is presented assembled.
export function explodeTargetOf(status: ExplodeStatus, product: string): number {
  return status.kind === 'active' && status.product === product ? status.target : 0
}

// The assembled rest: the target both ends of the toggle return to.
const ASSEMBLED = 0

// The far end of the view: the target a press opens to.
const OPEN = 1

// The three states one product's view can be in, the one answer every
// reader takes: assembled (target 0, also while nothing is attached),
// partly open (any target between, reached by a scrub) and fully open. The
// toggle announces it as unpressed, mixed or pressed, and its press acts
// from the same value, so the announced state is the state the press acts in.
export type ExplodeViewState = 'assembled' | 'partial' | 'open'

export function explodeViewOf(status: ExplodeStatus, product: string): ExplodeViewState {
  const target = explodeTargetOf(status, product)
  if (target === ASSEMBLED) {
    return 'assembled'
  }
  return target === OPEN ? 'open' : 'partial'
}

// The published applied progress of one product's exploded view, as the
// chrome displays it: idle while nothing publishes, live with the progress
// the pose last applied, for the one product whose view presents. It is
// display state, the same split the camera readout keeps: what was asked
// for is the status's target, this is where the pose is, and nothing
// drives the scene from it.
export type ExplodeReadout =
  | { readonly kind: 'idle' }
  | { readonly kind: 'live'; readonly product: string; readonly progress: number }

// The events the pose publishes: the applied progress of its product, and,
// on its release, that product's return to idle. A live event names its
// product, so the store can hold the newest pose; the idle event names its
// product, so a stale release cannot clear a newer view's readout.
export type ExplodeReadoutEvent =
  | { readonly kind: 'live'; readonly product: string; readonly progress: number }
  | { readonly kind: 'idle'; readonly product: string }

export const initialExplodeReadout: ExplodeReadout = { kind: 'idle' }

// Pure transition from (readout, event) to the next readout. A live event
// whose values equal the current ones returns the same readout object, so
// the store keeps its identity and subscribers see no change. An idle event
// for another product than the one publishing leaves the readout alone.
export function applyExplodeReadoutEvent(
  readout: ExplodeReadout,
  event: ExplodeReadoutEvent,
): ExplodeReadout {
  switch (event.kind) {
    case 'live': {
      const live: ExplodeReadout = {
        kind: 'live',
        product: event.product,
        progress: event.progress,
      }
      return sameLiveReadout(readout, live) ? readout : live
    }
    case 'idle':
      return readout.kind === 'live' && readout.product === event.product
        ? initialExplodeReadout
        : readout
  }
}

function sameLiveReadout(a: ExplodeReadout, b: Extract<ExplodeReadout, { kind: 'live' }>): boolean {
  return a.kind === 'live' && a.product === b.product && a.progress === b.progress
}

export type ExplodeEvent =
  | { kind: 'attached'; product: string }
  | { kind: 'detached'; product: string }
  | { kind: 'toggled'; product: string }
  | { kind: 'scrubbed'; product: string; target: number }

// Pure transition from (status, event) to the next status.
//
// Attach and detach are the presented view's paired lifetime. Attaching
// establishes that product's view, assembled, whatever the status held: a
// remount presents the product assembled, and an armed status of a previous
// presentation cannot survive into the next one. Detaching returns to idle
// when the status is that product's, and leaves another product's status
// alone, because a stale teardown must not close a newer view.
//
// Toggled and scrubbed act only on the attached product's view. An event
// for a product with no attached view leaves the status alone: a view that
// is not presented cannot move.
export function applyExplodeEvent(status: ExplodeStatus, event: ExplodeEvent): ExplodeStatus {
  switch (event.kind) {
    case 'attached':
      return attached(status, event.product)
    case 'detached':
      return detached(status, event.product)
    case 'toggled':
      return toggled(status, event.product)
    case 'scrubbed':
      return scrubbed(status, event.product, event.target)
  }
}

function attached(status: ExplodeStatus, product: string): ExplodeStatus {
  if (status.kind === 'active' && status.product === product && status.target === ASSEMBLED) {
    return status
  }
  return { kind: 'active', product, target: ASSEMBLED }
}

function detached(status: ExplodeStatus, product: string): ExplodeStatus {
  if (status.kind === 'active' && status.product === product) {
    return initialExplodeStatus
  }
  return status
}

// The press from each state: assembled opens fully, partly open completes
// the open, fully open closes to the assembled rest.
function toggled(status: ExplodeStatus, product: string): ExplodeStatus {
  if (status.kind !== 'active' || status.product !== product) {
    return status
  }
  const closes = explodeViewOf(status, product) === 'open'
  return { kind: 'active', product, target: closes ? ASSEMBLED : OPEN }
}

function scrubbed(status: ExplodeStatus, product: string, target: number): ExplodeStatus {
  // An out-of-range scrub is a caller error and fails with the map's typed
  // error; it is never clamped into the range.
  checkExplodeT(target)
  if (status.kind !== 'active' || status.product !== product) {
    return status
  }
  if (status.target === target) {
    return status
  }
  return { kind: 'active', product, target }
}
