import { useEffect } from 'react'
import type CameraControlsImpl from 'camera-controls'
import type { RefObject } from 'react'
import type { DistanceRange } from '@lib/camera/limits'
import type { CameraPlan } from './productPlan'
import { resizeCameraRange } from './resizeCameraRange'

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
  const aspect = size.width / size.height
  useEffect(() => {
    if (controls === null) {
      return
    }
    const plan = planRef.current
    const appliedRange = appliedRangeRef.current
    if (plan === null || appliedRange === null) {
      return
    }
    const range = resizeCameraRange(controls, plan, appliedRange, aspect)
    if (range === appliedRange) return
    appliedRangeRef.current = range
    invalidate()
  }, [controls, aspect, planRef, appliedRangeRef, invalidate])
}
