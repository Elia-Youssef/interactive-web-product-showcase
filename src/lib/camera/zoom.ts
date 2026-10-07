// The zoom percentage rule: the camera distance maps linearly from the
// maximum distance at 0 percent to the minimum distance at 100 percent,
// exactly, and one button step is a fixed number of percentage points.
// Pure math, exact to the float; the display rounds, never this module.

import type { DistanceRange } from './limits'

// The zoom percentage of a distance within the limits: 0 at the maximum,
// 100 at the minimum. The range must have its minimum below its maximum,
// which the limit rules enforce for every presented product.
export function zoomPercentOfDistance(distance: number, range: DistanceRange): number {
  return ((range.max - distance) / (range.max - range.min)) * 100
}

// The distance of a zoom percentage, inverting zoomPercentOfDistance: the
// same percentage reads back as the same distance.
export function distanceOfZoomPercent(percent: number, range: DistanceRange): number {
  return range.max - (percent / 100) * (range.max - range.min)
}

// The zoom percentage one button step away, in percentage points: zooming
// in (direction 1) moves toward 100, zooming out toward 0, and the result
// clamps to [0, 100], so the buttons stop at the limits.
export function steppedZoomPercent(
  percent: number,
  direction: 1 | -1,
  stepPercent: number,
): number {
  const stepped = percent + direction * stepPercent
  return Math.min(Math.max(stepped, 0), 100)
}

// Whether one zoom step in the direction can still move the camera: the
// move steps from the current percent through the same clamp, so a step
// whose clamped target is the percent it starts from moves nothing. The
// zoom buttons read this from the distance the camera holds and the limits
// it enforces, so a control waits disabled exactly while its press would
// do nothing, never by a rounded percent.
export function zoomStepMoves(
  distance: number,
  range: DistanceRange,
  direction: 1 | -1,
  stepPercent: number,
): boolean {
  const percent = zoomPercentOfDistance(distance, range)
  return steppedZoomPercent(percent, direction, stepPercent) !== percent
}
