// How the open hotspot card presents, as one pure decision over the layout's
// dock policy, the selected marker's placement, the card's measured size,
// the placement geometry and the slot the card is in now. The answer is a
// slot, floating on the stage or docked in the layout's dock, and whether
// the card shows in it.
//
// - A layout that docks every card (the phone's sheet) docks it whatever
//   the stage shows.
// - The open card hides with its marker, in either slot: it points at a
//   spot the visitor cannot see. A hidden card keeps the slot it is in, so a
//   marker that hides and shows again never moves its card between slots.
// - A floating card waits for its first measure before it can be placed,
//   then floats beside its marker, or docks when no side has room.

import type { StageBox } from './projection'
import {
  placeHotspotCard,
  type BoxSize,
  type CardMetrics,
  type CardSide,
  type StagePoint,
  type StageRect,
} from './cardPlacement'

// The layout's dock policy: 'always' docks every card, 'when-crowded' floats
// a card and docks it only when no side has room.
export const CARD_DOCK_POLICIES = ['always', 'when-crowded'] as const

export type CardDockPolicy = (typeof CARD_DOCK_POLICIES)[number]

// The two places a card can be.
export type CardSlotKind = 'floating' | 'docked'

export type CardPresentationInput = {
  readonly policy: CardDockPolicy
  // The stage box of the last placement pass, or null before the first.
  readonly stage: StageBox | null
  // The selected marker's placement, or null while it is hidden.
  readonly marker: StagePoint | null
  readonly placedMarkers: readonly StagePoint[]
  readonly obstacles: readonly StageRect[]
  // The floating card's measured size, or null before its first measure.
  readonly card: BoxSize | null
  readonly metrics: CardMetrics
  // The slot the card is in now, or null before its first decision.
  readonly current: CardSlotKind | null
}

// A floating card is placed beside its marker, or hidden (at null) while
// its marker is hidden or before its first measure. A docked card is shown
// or hidden in the dock.
export type CardPresentation =
  | {
      readonly slot: 'floating'
      readonly at: { readonly side: CardSide; readonly box: StageRect } | null
    }
  | { readonly slot: 'docked'; readonly shown: boolean }

const FLOATING_HIDDEN: CardPresentation = { slot: 'floating', at: null }
const DOCKED_SHOWN: CardPresentation = { slot: 'docked', shown: true }
const DOCKED_HIDDEN: CardPresentation = { slot: 'docked', shown: false }

export function presentHotspotCard(input: CardPresentationInput): CardPresentation {
  const placed = input.stage !== null && input.marker !== null
  if (input.policy === 'always') {
    return placed ? DOCKED_SHOWN : DOCKED_HIDDEN
  }
  if (input.stage === null || input.marker === null) {
    return input.current === 'docked' ? DOCKED_HIDDEN : FLOATING_HIDDEN
  }
  if (input.card === null) {
    return FLOATING_HIDDEN
  }
  const placement = placeHotspotCard({
    stage: input.stage,
    marker: input.marker,
    placedMarkers: input.placedMarkers,
    obstacles: input.obstacles,
    card: input.card,
    metrics: input.metrics,
  })
  return placement.kind === 'docked'
    ? DOCKED_SHOWN
    : { slot: 'floating', at: { side: placement.side, box: placement.box } }
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
