import { useEffect } from 'react'
import type { CameraControlsImpl } from '@react-three/drei'
import type { RefObject } from 'react'
import { orbitAnglesOf } from '@lib/camera/view'
import { distanceOfZoomPercent, zoomPercentOfDistance } from '@lib/camera/zoom'
import type { DistanceRange } from '@lib/camera/limits'
import type { CameraPlan } from './productPlan'
import { readControlsEndState, scaledRangeOf } from './controls'

// The resize of the presented view: the distances rescale by the aspect
// rule and the zoom percentage and both angles stay. The move is instant:
// a resize is a correction, not a camera move of its own. The percentage
// is read against the range the limits held before the rescale, which the
// applied range ref carries.
export function useCameraResize(
  controls: CameraControlsImpl | null,
  size: { readonly width: number; readonly height: number },
  planRef: RefObject<CameraPlan | null>,
  appliedRangeRef: RefObject<DistanceRange | null>,
  invalidate: () => void,
): void {
  useEffect(() => {
    if (controls === null) {
      return
    }
    const plan = planRef.current
    const appliedRange = appliedRangeRef.current
    if (plan === null || appliedRange === null) {
      return
    }
    const end = readControlsEndState(controls)
    const percent = zoomPercentOfDistance(
      orbitAnglesOf(end.position, end.target).distance,
      appliedRange,
    )
    const range = scaledRangeOf(plan, size.width / size.height)
    controls.minDistance = range.min
    controls.maxDistance = range.max
    appliedRangeRef.current = range
    void controls.dollyTo(distanceOfZoomPercent(percent, range), false)
    invalidate()
  }, [controls, size, planRef, appliedRangeRef, invalidate])
}
