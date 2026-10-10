import type CameraControls from 'camera-controls'
import type { DistanceRange } from '@lib/camera/limits'
import { distanceOfZoomPercent, zoomPercentOfDistance } from '@lib/camera/zoom'
import type { CameraPlan } from './productPlan'
import { readControlsEndOrbit, scaledRangeOf } from './controls'

// Resize only the range imposed by the aspect. Viewport position and an
// equivalent aspect scale leave both an idle orbit and an eased move intact.
export function resizeCameraRange(
  controls: CameraControls,
  plan: CameraPlan,
  applied: DistanceRange,
  aspect: number,
): DistanceRange {
  const range = scaledRangeOf(plan, aspect)
  if (range.min === applied.min && range.max === applied.max) return applied
  const percent = zoomPercentOfDistance(readControlsEndOrbit(controls).distance, applied)
  controls.minDistance = range.min
  controls.maxDistance = range.max
  void controls.dollyTo(distanceOfZoomPercent(percent, range), false)
  return range
}
