// Every stage camera tunable, with its unit in the name. Nothing reaches
// the controls that is not written here, so the camera's feel is one
// place's data and no bare number sits inline anywhere else.

export type StageCameraConfig = {
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
  // The distance limits where the product authors none, as ratios of the
  // authored home distance at the authored aspect.
  readonly minHomeDistanceRatio: number
  readonly maxHomeDistanceRatio: number
  // The orbit's polar limits in degrees, measured from straight up: the
  // camera never goes nearer the poles than these.
  readonly minPolarAngleDegrees: number
  readonly maxPolarAngleDegrees: number
  // One zoom button step, in percentage points.
  readonly zoomStepPercent: number
}

export const stageCameraConfig: StageCameraConfig = {
  transitionSmoothTimeSeconds: 0.65,
  draggingSmoothTimeSeconds: 0.08,
  wheelDollySpeed: 1,
  minHomeDistanceRatio: 0.5,
  maxHomeDistanceRatio: 2.5,
  minPolarAngleDegrees: 15,
  maxPolarAngleDegrees: 165,
  zoomStepPercent: 10,
}
