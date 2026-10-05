import { initialHotspotStatus, selectionOf, type HotspotStatus } from '@lib/hotspots/flow'

export type { HotspotStatus } from '@lib/hotspots/flow'

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
