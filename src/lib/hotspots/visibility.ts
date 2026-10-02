// The visibility rule of a hotspot marker, as pure math: the projection says
// where the anchor lands and whether it is in front, the occluder raycast
// says what stands between the camera and the anchor, and the rule combines
// them. The rule carries no epsilon: an anchor exactly on the surface of its
// occluder is an asset problem, not a number to tune here. Anchors sit off
// the surface by the asset contract, so a hit at the anchor's own distance
// is the anchor's own part at worst, never a nearer occluder.

import type { StageBox, StageProjection } from './projection'
import { isInsideStageBox } from './projection'

// The nearest occluder hit along the ray from the camera to the anchor, or
// null when the ray reaches the anchor without touching any occluder. The
// anchor is occluded when that hit is nearer than the anchor itself: a hit
// at the anchor's own distance does not occlude it.
export function isOccluded(anchorDistance: number, nearestHitDistance: number | null): boolean {
  return nearestHitDistance !== null && nearestHitDistance < anchorDistance
}

// A marker shows when its anchor is in front of the camera, its projection
// lands inside the stage box, and nothing stands between the camera and the
// anchor. Every other combination hides it.
export function isMarkerVisible(
  projection: StageProjection,
  stage: StageBox,
  occluded: boolean,
): boolean {
  return projection.inFront && isInsideStageBox(projection, stage) && !occluded
}
