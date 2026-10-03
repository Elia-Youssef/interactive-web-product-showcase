// The box a hotspot marker owns on the stage, as pure geometry: its square
// hit box, centered on the marker's placement, grown by how far its focus
// ring reaches outside it. The card keeps clear of this box around every
// placed marker, and a marker shows only while this box fits inside the
// stage, so the one box serves both rules. All lengths are CSS pixels in
// the stage box, y running down, the space the marker projection answers
// in.
//
// The math is exact: a box that only touches the stage edge is inside it.

import type { StageBox } from './projection'

export type StagePoint = {
  readonly x: number
  readonly y: number
}

// An axis-aligned box in the stage, edges as coordinates.
export type StageRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// The lengths a marker's box is built from, as the stylesheets declare
// them.
export type MarkerExtent = {
  // The side of a marker's square hit box, centered on its placement.
  readonly markerHitPx: number
  // How far a marker's focus ring reaches outside its hit box: the ring's
  // offset plus its width.
  readonly focusOutsetPx: number
}

// The box a marker keeps clear: its hit box grown by the focus ring's reach
// on every side.
export function markerKeepOut(marker: StagePoint, extent: MarkerExtent): StageRect {
  const half = extent.markerHitPx / 2 + extent.focusOutsetPx
  return {
    left: marker.x - half,
    top: marker.y - half,
    right: marker.x + half,
    bottom: marker.y + half,
  }
}

// Whether the marker's whole keep-out box lies inside the stage, edges
// included: a marker whose box crosses an edge would put part of its hit
// area or its focus ring under whatever sits beside the stage.
export function isKeepOutInsideStage(
  marker: StagePoint,
  stage: StageBox,
  extent: MarkerExtent,
): boolean {
  return isRectInsideStage(markerKeepOut(marker, extent), stage)
}

// Whether a box lies inside the stage, edges included.
export function isRectInsideStage(box: StageRect, stage: StageBox): boolean {
  return box.left >= 0 && box.top >= 0 && box.right <= stage.width && box.bottom <= stage.height
}
