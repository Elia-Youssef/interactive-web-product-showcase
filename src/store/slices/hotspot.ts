import {
  applyHotspotEvent,
  initialHotspotStatus,
  type HotspotEvent,
  type HotspotStatus,
} from './hotspot.logic'

export type { HotspotStatus } from './hotspot.logic'

export type HotspotSliceState = {
  hotspotStatus: HotspotStatus
}

export type HotspotSlice = HotspotSliceState & {
  hotspotToggled: (product: string, hotspot: string) => void
  hotspotCleared: (product: string) => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetHotspotState = (updater: (state: HotspotSliceState) => Partial<HotspotSliceState>) => void

export function createHotspotSlice(set: SetHotspotState): HotspotSlice {
  const apply = (event: HotspotEvent) => {
    set((state) => ({ hotspotStatus: applyHotspotEvent(state.hotspotStatus, event) }))
  }

  return {
    hotspotStatus: initialHotspotStatus,
    hotspotToggled: (product, hotspot) => apply({ kind: 'toggled', product, hotspot }),
    hotspotCleared: (product) => apply({ kind: 'cleared', product }),
  }
}

export function selectHotspotStatus(state: HotspotSliceState): HotspotStatus {
  return state.hotspotStatus
}

// The selected hotspot of one product, or null while that product holds no
// selection. Every caller names the product it asks for, so a product switch
// renders the next product's markers unpressed instead of reaching the last
// product's selection.
export function selectSelectedHotspot(state: HotspotSliceState, product: string): string | null {
  const status = state.hotspotStatus
  return status.kind === 'selected' && status.product === product ? status.hotspot : null
}
