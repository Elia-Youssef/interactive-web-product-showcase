import { overlayKey } from '@features/hotspots'
import type { OverlayPassRelease, StageOverlay } from '@viewer/overlay/StageOverlay'
import type { CommittedCardRead } from '@viewer/overlay/CommittedCard'

// One overlay pass as the open card and its marker left it.
export type HarnessCardVisibilitySample = {
  // The explode progress the pass's frame applied, or null while the view
  // publishes none.
  readonly t: number | null
  readonly selected: string
  readonly markerVisible: boolean
  readonly cardVisible: boolean
  readonly card: CommittedCardRead | null
  readonly frame: number
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
    const card = overlay.card.read()
    add({
      t: selection.t,
      selected: selection.selected,
      markerVisible: overlay.placementOf(overlayKey(selection.selected))?.kind === 'placed',
      cardVisible: card?.selected === selection.selected && card.mounted && card.shown,
      card,
      frame: overlay.presentedFrame,
    })
  }, 'observer')
}
