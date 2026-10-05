import { CARD_OVERLAY_KEY, overlayKey } from '@features/hotspots'
import type { OverlayPassRelease, StageOverlay } from '@viewer/overlay/StageOverlay'

// One overlay pass as the open card and its marker left it.
export type HarnessCardVisibilitySample = {
  // The explode progress the pass's frame applied, or null while the view
  // publishes none.
  readonly t: number | null
  readonly selected: string
  readonly markerVisible: boolean
  readonly cardVisible: boolean
}

// What the observer reads from the store at a pass: the open hotspot and
// the applied progress, or null while no card is open.
export type CardSelectionRead = () => {
  readonly selected: string
  readonly t: number | null
} | null

// Records one sample per overlay pass while a card is open. It observes
// the pass, so it runs after every presenter, the card's among them, and
// each sample holds the frame's final placements, whichever of the two
// subscribed first.
export function observeCardVisibility(
  overlay: StageOverlay,
  read: CardSelectionRead,
  add: (sample: HarnessCardVisibilitySample) => void,
): OverlayPassRelease {
  return overlay.onPass(() => {
    const selection = read()
    if (selection === null) {
      return
    }
    add({
      t: selection.t,
      selected: selection.selected,
      markerVisible: overlay.placementOf(overlayKey(selection.selected))?.kind === 'placed',
      cardVisible: overlay.placementOf(CARD_OVERLAY_KEY)?.kind === 'placed',
    })
  }, 'observer')
}
