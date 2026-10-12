// Every stage camera tunable, with its unit in the name. Nothing reaches
// the controls that is not written here, so the camera's feel is one
// place's data and no bare number sits inline anywhere else. The limit
// values are the camera contract's own, read from the one place the
// build-time validate step reads them from.

import type { CameraLimitConfig } from '@lib/camera/config'
import { cameraLimitConfig } from '@lib/camera/config'
import type { OrbitStepConfig } from '@lib/camera/orbitStep'

// The orbit steps are degrees: a rotate step turns the azimuth, a tilt step
// the polar angle, and the fine step (Shift on the keys) is either one.
export type StageCameraConfig = CameraLimitConfig &
  OrbitStepConfig & {
    // The eased time constant of a camera transition, in seconds. The design
    // window for camera moves is 600 to 900 ms, with no bounce: the controls
    // move critically damped, so the value is the smooth time, not a hard
    // duration.
    readonly transitionSmoothTimeSeconds: number
    // The time constant while the visitor is dragging or pinching, in
    // seconds: shorter, so the camera follows the hand.
    readonly draggingSmoothTimeSeconds: number
    // The wheel dolly speed multiplier of the controls.
    readonly wheelDollySpeed: number
    // One zoom button step, in percentage points.
    readonly zoomStepPercent: number
  }

export const stageCameraConfig: StageCameraConfig = {
  ...cameraLimitConfig,
  transitionSmoothTimeSeconds: 0.65,
  draggingSmoothTimeSeconds: 0.08,
  wheelDollySpeed: 1,
  zoomStepPercent: 10,
  rotateStepDegrees: 15,
  tiltStepDegrees: 15,
  fineStepDegrees: 5,
}
