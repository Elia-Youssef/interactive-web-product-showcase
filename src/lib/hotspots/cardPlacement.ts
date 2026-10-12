// Where the open hotspot card goes, as pure geometry over the stage box. The
// card floats beside its marker on the first side, in preference order,
// whose box stays inside the stage, covers no placed marker (neither its
// hit box nor the focus ring drawn around it, so every marker stays
// pressable and its keyboard focus stays visible), covers no obstacle
// (the stage chrome painted over the overlay, so nothing hides the card's
// own controls) and covers none of its subject (the part the open hotspot
// describes, whose projected extent is an obstacle like any other, so the
// card never hides what it is about). When no side qualifies the card docks.
// All lengths are CSS pixels in the stage box, y running down, the space
// the marker projection answers in.
//
// The math is exact: a box that only touches the stage edge is inside it,
// and a box that only touches a keep-out box or an obstacle does not cover
// it.
//
// The answer is written into a caller-owned target, so a per-pass caller
// reuses its storage and allocates nothing: the target doubles as the
// working box of the side under test.

import type { StageBox, StageRectTarget } from './projection'
import {
  isRectInsideStage,
  markerKeepOutHalfPx,
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

// The spot a floating card takes: the side it floats on and the box it
// occupies there, mutable so the caller owns the one record it is filled
// into.
export type FloatingCardSpot = {
  side: CardSide
  left: number
  top: number
  right: number
  bottom: number
}

// Places the card into the spot: true when it floats beside the marker,
// with the spot holding the side it chose and that side's box; false when
// it docks, with no side qualifying.
export function placeHotspotCard(input: CardPlacementInput, spot: FloatingCardSpot): boolean {
  for (const side of CARD_SIDES) {
    cardBoxAt(side, input.marker, input.card, input.metrics, spot)
    spot.side = side
    if (
      isRectInsideStage(spot, input.stage) &&
      !coversAnyMarker(spot, input) &&
      !(input.subject !== null && overlaps(spot, input.subject)) &&
      !coversAnyObstacle(spot, input.obstacles)
    ) {
      return true
    }
  }
  return false
}

// The card's box on one side of the marker: the token gap off the marker's
// hit box along the side's axis, centered on the marker across it, written
// into the target.
export function cardBoxAt(
  side: CardSide,
  marker: StagePoint,
  card: BoxSize,
  metrics: CardMetrics,
  target: StageRectTarget,
): void {
  const reach = metrics.markerHitPx / 2 + metrics.cardOffsetPx
  switch (side) {
    case 'right':
      besideAt(marker.x + reach, marker.y - card.height / 2, card, target)
      return
    case 'left':
      besideAt(marker.x - reach - card.width, marker.y - card.height / 2, card, target)
      return
    case 'below':
      besideAt(marker.x - card.width / 2, marker.y + reach, card, target)
      return
    case 'above':
      besideAt(marker.x - card.width / 2, marker.y - reach - card.height, card, target)
      return
  }
}

function besideAt(left: number, top: number, card: BoxSize, target: StageRectTarget): void {
  target.left = left
  target.top = top
  target.right = left + card.width
  target.bottom = top + card.height
}

function coversAnyMarker(box: StageRect, input: CardPlacementInput): boolean {
  const half = markerKeepOutHalfPx(input.metrics)
  for (const marker of input.placedMarkers) {
    if (overlapsBounds(box, marker.x - half, marker.y - half, marker.x + half, marker.y + half)) {
      return true
    }
  }
  return false
}

function coversAnyObstacle(box: StageRect, obstacles: readonly StageRect[]): boolean {
  for (const obstacle of obstacles) {
    if (overlaps(box, obstacle)) {
      return true
    }
  }
  return false
}

// Two boxes overlap when they share area; boxes that only touch do not.
function overlaps(a: StageRect, b: StageRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

// A box against an axis-aligned box given by its edges, the keep-out test's
// shape: the marker's center and its extent, with no record built for it.
function overlapsBounds(
  a: StageRect,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return a.left < right && left < a.right && a.top < bottom && top < a.bottom
}
