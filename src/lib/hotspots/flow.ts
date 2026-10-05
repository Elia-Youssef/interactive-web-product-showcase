// The hotspot flow as one pure state machine over the hotspot status. The
// status is the one selection of the one store every product shares, so it
// names the product it belongs to, and the close-up the flow has entered
// belongs to that selection: a close-up of one product can never stand for
// a hotspot of the same id on another. A step answers the next status and
// the view the camera owes, or null when the step owes no move; the store
// writes both in one update.
//
// The rules:
// - Pressing a marker opens its hotspot, or closes it when it is the active
//   one. An opened hotspot enters its close-up only when it has one and the
//   product is assembled (its explode target is 0): close-ups frame the
//   assembled product. Opening owes the close-up's view, or home when the
//   selection it replaces was in a close-up, or nothing.
// - Closing (Escape, the card's close, the active marker) clears the
//   selection and owes home only from a close-up.
// - The product leaving its assembled pose (its explode target leaves 0)
//   keeps the selection, leaves the close-up and owes home from one.
// - Reset clears any selection and always owes home.
// - Leaving the product clears its selection and owes no move: the next
//   product presents its own home view.

import { CAMERA_HOME_ID } from '../product/contractNames'

export type HotspotStatus =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'selected'
      // The slug of the one product the selection belongs to.
      readonly product: string
      // The manifest hotspot id the selection holds.
      readonly hotspot: string
      // Whether the flow entered this hotspot's close-up and has not left
      // it: the camera presents the close-up view.
      readonly closeUp: boolean
    }

export type SelectedHotspot = Extract<HotspotStatus, { kind: 'selected' }>

export const initialHotspotStatus: HotspotStatus = { kind: 'idle' }

export type HotspotFlowEvent =
  | {
      readonly kind: 'pressed'
      readonly product: string
      readonly hotspot: string
      // Whether the model carries a close-up camera for the hotspot.
      readonly hasCloseUp: boolean
      // Whether the product's explode target is 0.
      readonly assembled: boolean
    }
  | { readonly kind: 'closed'; readonly product: string }
  | { readonly kind: 'disassembled'; readonly product: string }
  | { readonly kind: 'reset' }
  | { readonly kind: 'left'; readonly product: string }

// One step of the flow: the next status, and the id of the view the camera
// owes, or null. A step that changes nothing answers the status it was
// given, so a caller can tell a no-op by identity.
export type HotspotFlowTransition = {
  readonly status: HotspotStatus
  readonly view: string | null
}

export function transitionHotspotFlow(
  status: HotspotStatus,
  event: HotspotFlowEvent,
): HotspotFlowTransition {
  switch (event.kind) {
    case 'pressed':
      return pressed(status, event)
    case 'closed':
      return closed(status, event.product)
    case 'disassembled':
      return disassembled(status, event.product)
    case 'reset':
      return { status: initialHotspotStatus, view: CAMERA_HOME_ID }
    case 'left': {
      const selection = selectionOf(status, event.product)
      return { status: selection === null ? status : initialHotspotStatus, view: null }
    }
  }
}

// The selection of one product, or null while that product holds none: a
// status that belongs to another product is no selection of this one.
export function selectionOf(status: HotspotStatus, product: string): SelectedHotspot | null {
  return status.kind === 'selected' && status.product === product ? status : null
}

function pressed(
  status: HotspotStatus,
  event: Extract<HotspotFlowEvent, { kind: 'pressed' }>,
): HotspotFlowTransition {
  const selection = selectionOf(status, event.product)
  if (selection !== null && selection.hotspot === event.hotspot) {
    return closed(status, event.product)
  }
  const closeUp = event.hasCloseUp && event.assembled
  return {
    status: { kind: 'selected', product: event.product, hotspot: event.hotspot, closeUp },
    view: closeUp ? event.hotspot : homeFrom(selection),
  }
}

function closed(status: HotspotStatus, product: string): HotspotFlowTransition {
  const selection = selectionOf(status, product)
  if (selection === null) {
    return { status, view: null }
  }
  return { status: initialHotspotStatus, view: homeFrom(selection) }
}

function disassembled(status: HotspotStatus, product: string): HotspotFlowTransition {
  const selection = selectionOf(status, product)
  if (selection === null || !selection.closeUp) {
    return { status, view: null }
  }
  return { status: { ...selection, closeUp: false }, view: CAMERA_HOME_ID }
}

// Home when the selection being left was in a close-up, else no move.
function homeFrom(selection: SelectedHotspot | null): string | null {
  return selection !== null && selection.closeUp ? CAMERA_HOME_ID : null
}
