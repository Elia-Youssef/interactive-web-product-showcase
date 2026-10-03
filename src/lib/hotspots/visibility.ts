// The visibility rule of a hotspot marker, as pure math: the projection says
// where the anchor lands and whether it is in front, the occluder raycast
// says what stands between the camera and the anchor, and the rule combines
// them. The rule carries no epsilon: an anchor exactly on the surface of its
// occluder is an asset problem, not a number to tune here. Anchors sit off
// the surface by the asset contract, so a hit at the anchor's own distance
// is the anchor's own part at worst, never a nearer occluder.

import type { StageBox, StageProjection } from './projection'
import { isKeepOutInsideStage, type MarkerExtent } from './markerBox'

// The nearest occluder hit along the ray from the camera to the anchor, or
// null when the ray reaches the anchor without touching any occluder. The
// anchor is occluded when that hit is nearer than the anchor itself: a hit
// at the anchor's own distance does not occlude it.
export function isOccluded(anchorDistance: number, nearestHitDistance: number | null): boolean {
  return nearestHitDistance !== null && nearestHitDistance < anchorDistance
}

// A marker shows when its anchor is in front of the camera, its whole
// keep-out box (the hit box grown by the focus ring's reach, centered on
// the projection) fits inside the stage box, and nothing stands between
// the camera and the anchor. Every other combination hides it: a marker
// whose box crosses a stage edge hides like an occluded one, so no part of
// a shown marker's hit area or focus ring ever lies under whatever sits
// beside the stage.
export function isMarkerPlaceable(
  projection: StageProjection,
  stage: StageBox,
  extent: MarkerExtent,
): boolean {
  return projection.inFront && isKeepOutInsideStage(projection, stage, extent)
}

export function isMarkerVisible(
  projection: StageProjection,
  stage: StageBox,
  extent: MarkerExtent,
  occluded: boolean,
): boolean {
  return isMarkerPlaceable(projection, stage, extent) && !occluded
}
