// The hotspot selection as a small state machine, one event at a time. Every
// event names the product it belongs to, because one store is shared by
// every product: an unnamed selection reaches the next product and
// mislabels its markers. A press toggles: the pressed marker is the active
// hotspot, and pressing it again clears the selection, so one value carries
// the one-active-hotspot rule.

export type IdleHotspotStatus = { readonly kind: 'idle' }

export type SelectedHotspotStatus = {
  readonly kind: 'selected'
  // The slug of the one product this selection belongs to.
  readonly product: string
  // The manifest hotspot id the selection holds.
  readonly hotspot: string
}

export type HotspotStatus = IdleHotspotStatus | SelectedHotspotStatus

export type HotspotEvent =
  { kind: 'toggled'; product: string; hotspot: string } | { kind: 'cleared'; product: string }

export const initialHotspotStatus: HotspotStatus = { kind: 'idle' }

// Pure transition from (status, event) to the next status. A press for a
// product the status does not belong to still lands as that product's
// selection, replacing a stale one: the selector answers null for every
// other product, so a stale selection can never show.
export function applyHotspotEvent(status: HotspotStatus, event: HotspotEvent): HotspotStatus {
  switch (event.kind) {
    case 'toggled':
      return toggle(status, event.product, event.hotspot)
    case 'cleared':
      return clear(status, event.product)
  }
}

// Pressing the active hotspot of its product clears the selection; pressing
// any other selects it.
function toggle(status: HotspotStatus, product: string, hotspot: string): HotspotStatus {
  if (status.kind === 'selected' && status.product === product && status.hotspot === hotspot) {
    return initialHotspotStatus
  }
  return { kind: 'selected', product, hotspot }
}

// The selection a toggle press lands on, without applying it: the hotspot
// feature owes the camera the change between the selection before its press
// and this one. The same rule applyHotspotEvent applies, asked as a
// question so the flow never restates it.
export function selectionAfterToggle(
  status: HotspotStatus,
  product: string,
  hotspot: string,
): string | null {
  const next = applyHotspotEvent(status, { kind: 'toggled', product, hotspot })
  return next.kind === 'selected' && next.product === product ? next.hotspot : null
}

// Clearing the selection of the product that holds it leaves the status at
// rest; another product's clear is a no-op, because the selector already
// answers null for it.
function clear(status: HotspotStatus, product: string): HotspotStatus {
  if (status.kind === 'selected' && status.product === product) {
    return initialHotspotStatus
  }
  return status
}
