import {
  initialHotspotStatus,
  selectionOf,
  type HotspotStatus,
  type SelectedHotspot,
} from '@lib/hotspots/flow'

export type { HotspotOrigin, HotspotStatus, SelectedHotspot } from '@lib/hotspots/flow'

// The hotspot slice holds the flow's one status. Every write goes through
// the flow's composed actions (createAppStore), which apply one transition
// per event together with the camera request it owes, so the slice itself
// carries no action.
export type HotspotSliceState = {
  hotspotStatus: HotspotStatus
}

export type HotspotSlice = HotspotSliceState

export function createHotspotSlice(): HotspotSlice {
  return { hotspotStatus: initialHotspotStatus }
}

// The selected hotspot of one product, or null while that product holds no
// selection. Every caller names the product it asks for, so a product switch
// renders the next product's markers unpressed instead of reaching the last
// product's selection.
export function selectSelectedHotspot(state: HotspotSliceState, product: string): string | null {
  return selectionOf(state.hotspotStatus, product)?.hotspot ?? null
}

// The whole selection of one product, its origin and close-up included, or
// null while that product holds none. The status object itself, so a
// subscriber re-renders when the selection changes and not otherwise.
export function selectHotspotSelection(
  state: HotspotSliceState,
  product: string,
): SelectedHotspot | null {
  return selectionOf(state.hotspotStatus, product)
}
