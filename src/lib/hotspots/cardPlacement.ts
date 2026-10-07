// Where the open hotspot card goes, as pure geometry over the stage box. The
// card floats beside its marker on the first side, in preference order,
// whose box stays inside the stage, covers no placed marker (neither its
// hit box nor the focus ring drawn around it, so every marker stays
// pressable and its keyboard focus stays visible), covers no obstacle
// (the stage chrome painted over the overlay, so nothing hides the card's
// own controls) and covers none of its subject (the part the open hotspot
// describes, whose projected extent is an obstacle like any other, so the
// card never hides what it is about). When no side qualifies the card docks.
// All lengths are CSS pixels in the stage box, y running down, the space the
// marker projection answers in.
//
// The math is exact: a box that only touches the stage edge is inside it,
// and a box that only touches a keep-out box or an obstacle does not cover
// it.

import type { StageBox } from './projection'
import {
  isRectInsideStage,
  markerKeepOut,
  type MarkerExtent,
  type StagePoint,
  type StageRect,
} from './markerBox'

export type BoxSize = {
  readonly width: number
  readonly height: number
}

// The sides of a floating card, in preference order: beside the marker
// first, reading on, then under and over it.
export const CARD_SIDES = ['right', 'left', 'below', 'above'] as const

export type CardSide = (typeof CARD_SIDES)[number]

// The lengths the card geometry is built from: the marker's own box, and
// the gap between the selected marker's hit box and its card.
export type CardMetrics = MarkerExtent & {
  readonly cardOffsetPx: number
}

export type CardPlacementInput = {
  readonly stage: StageBox
  // The selected marker's placement: the card hangs off its hit box.
  readonly marker: StagePoint
  // Every placed marker, the selected one included: the card covers none of
  // their keep-out boxes, its own marker's ring among them.
  readonly placedMarkers: readonly StagePoint[]
  // The projected extent of the open hotspot's subject, the part its anchor
  // rides on, or null while the canvas side has published none.
  readonly subject: StageRect | null
  // The boxes over the stage the card must leave uncovered.
  readonly obstacles: readonly StageRect[]
  readonly card: BoxSize
  readonly metrics: CardMetrics
}

export type CardPlacement =
  | { readonly kind: 'beside'; readonly side: CardSide; readonly box: StageRect }
  | { readonly kind: 'docked' }

const DOCKED: CardPlacement = { kind: 'docked' }

export function placeHotspotCard(input: CardPlacementInput): CardPlacement {
  for (const side of CARD_SIDES) {
    const box = cardBoxAt(side, input.marker, input.card, input.metrics)
    if (
      isRectInsideStage(box, input.stage) &&
      !coversAnyMarker(box, input) &&
      !(input.subject !== null && overlaps(box, input.subject)) &&
      !input.obstacles.some((obstacle) => overlaps(box, obstacle))
    ) {
      return { kind: 'beside', side, box }
    }
  }
  return DOCKED
}

// The card's box on one side of the marker: the token gap off the marker's
// hit box along the side's axis, centered on the marker across it.
export function cardBoxAt(
  side: CardSide,
  marker: StagePoint,
  card: BoxSize,
  metrics: CardMetrics,
): StageRect {
  const reach = metrics.markerHitPx / 2 + metrics.cardOffsetPx
  switch (side) {
    case 'right':
      return besideAt(marker.x + reach, marker.y - card.height / 2, card)
    case 'left':
      return besideAt(marker.x - reach - card.width, marker.y - card.height / 2, card)
    case 'below':
      return besideAt(marker.x - card.width / 2, marker.y + reach, card)
    case 'above':
      return besideAt(marker.x - card.width / 2, marker.y - reach - card.height, card)
  }
}

function besideAt(left: number, top: number, card: BoxSize): StageRect {
  return { left, top, right: left + card.width, bottom: top + card.height }
}

function coversAnyMarker(box: StageRect, input: CardPlacementInput): boolean {
  return input.placedMarkers.some((marker) => overlaps(box, markerKeepOut(marker, input.metrics)))
}

// Two boxes overlap when they share area; boxes that only touch do not.
function overlaps(a: StageRect, b: StageRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}
