// How the open hotspot card presents, as one pure decision over where the
// selection was opened from, the layout's dock policy, the selected
// marker's placement, the card's measured size, the placement geometry and
// the slot the card is in now. The answer is a slot, listed under its own
// Highlights list item, floating on the stage or docked in the layout's
// dock, and whether the card shows in it.
//
// - A card opened from the Highlights list is listed, always shown: it
//   renders under the list item that opened it, so it never hides with a
//   marker the view hides, whatever the stage shows.
// - A layout that docks every card (the phone's sheet) docks a marker's
//   card whatever the stage shows.
// - A docked card stays readable throughout its selection. Only a
//   floating card hides with its marker, keeping its slot until the
//   marker can anchor it again.
// - A floating card waits for its first measure before it can be placed,
//   then floats beside its marker without covering its subject, or docks
//   when no side has room.
//
// The answer is a union the caller switches on exhaustively. Every case
// that can recur returns a constant record, and the one case with a
// position returns the caller's own floating record, filled by the
// placement rule, so a per-pass decision allocates nothing.

import type { HotspotOrigin } from './flow'
import type { StageBox } from './projection'
import {
  placeHotspotCard,
  type BoxSize,
  type CardMetrics,
  type FloatingCardSpot,
} from './cardPlacement'
import type { StagePoint, StageRect } from './markerBox'

// The layout's dock policy: 'always' docks every card, 'when-crowded' floats
// a card and docks it only when no side has room.
export const CARD_DOCK_POLICIES = ['always', 'when-crowded'] as const

export type CardDockPolicy = (typeof CARD_DOCK_POLICIES)[number]

// The three places a card can be.
export type CardSlotKind = 'listed' | 'floating' | 'docked'

export type CardPresentationInput = {
  // Where the selection was opened from.
  readonly origin: HotspotOrigin
  readonly policy: CardDockPolicy
  // The stage box of the last placement pass, or null before the first.
  readonly stage: StageBox | null
  // The selected marker's placement, or null while it is hidden.
  readonly marker: StagePoint | null
  readonly placedMarkers: readonly StagePoint[]
  // The projected extent of the selected hotspot's subject, or null while
  // the canvas side has published none.
  readonly subject: StageRect | null
  readonly obstacles: readonly StageRect[]
  // The floating card's measured size, or null before its first measure.
  readonly card: BoxSize | null
  readonly metrics: CardMetrics
  // The slot the card is in now, or null before its first decision.
  readonly current: CardSlotKind | null
}

// A listed card shows under its list item. A floating card is placed
// beside its marker, or hidden (at null) while its marker is hidden or
// before its first measure. A docked card stays shown in the dock.
export type CardPresentation =
  | { readonly slot: 'listed' }
  | { readonly slot: 'docked' }
  | { readonly slot: 'floating'; readonly at: FloatingCardSpot | null }

// The caller's floating record: the presentation returned when the card
// floats beside its marker, its spot filled by the placement rule. Owned
// by the caller, refilled per decision.
export type FloatingCard = {
  slot: 'floating'
  at: FloatingCardSpot
}

const LISTED: CardPresentation = { slot: 'listed' }
const DOCKED_SHOWN: CardPresentation = { slot: 'docked' }
const FLOATING_HIDDEN: CardPresentation = { slot: 'floating', at: null }

export function presentHotspotCard(
  input: CardPresentationInput,
  floating: FloatingCard,
): CardPresentation {
  if (input.origin === 'list') {
    return LISTED
  }
  const markerPlaced = placedOnStage(input)
  if (input.policy === 'always') {
    return DOCKED_SHOWN
  }
  if (!markerPlaced) {
    return input.current === 'docked' ? DOCKED_SHOWN : FLOATING_HIDDEN
  }
  if (!measuredOnStage(input)) {
    return FLOATING_HIDDEN
  }
  return placeHotspotCard(input, floating.at) ? floating : DOCKED_SHOWN
}

// Whether the decision has a placed marker on a staged pass: the placement
// rule's precondition on the stage and the marker.
function placedOnStage(
  input: CardPresentationInput,
): input is CardPresentationInput & { stage: StageBox; marker: StagePoint } {
  return input.stage !== null && input.marker !== null
}

// Whether that placed, staged selection also carries the card's first
// measure: the placement rule's last precondition, completing its view of
// the input so the rule reads the presentation input itself.
function measuredOnStage(
  input: CardPresentationInput & { stage: StageBox; marker: StagePoint },
): input is CardPresentationInput & { stage: StageBox; marker: StagePoint; card: BoxSize } {
  return input.card !== null
}

// The policy a layout declares, as text, checked at the boundary: an
// unknown value is a stylesheet error and fails loudly instead of floating
// or docking by accident.
export function parseCardDockPolicy(value: string): CardDockPolicy {
  const policy = CARD_DOCK_POLICIES.find((candidate) => candidate === value)
  if (policy === undefined) {
    throw new Error(
      `the hotspot card dock policy '${value}' is none of ${CARD_DOCK_POLICIES.join(', ')}`,
    )
  }
  return policy
}
