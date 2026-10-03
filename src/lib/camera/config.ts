// The authored camera contract of the project, as data: the distance and
// polar limits the authored home view must satisfy, and the one camera
// aspect every product is exported at. The runtime plan and the build-time
// validate step read these values from here, so a rule tuned in one place
// is tuned in both, and no limit or aspect sits inline anywhere else.

// The distance and polar limits of the home view. The distance sides are
// ratios of the authored home distance, the polar sides degrees measured
// from straight up.
export type CameraLimitConfig = {
  // The fallback distance limits, as ratios of the authored home distance.
  readonly minHomeDistanceRatio: number
  readonly maxHomeDistanceRatio: number
  // The orbit's polar limits in degrees, measured from straight up: the
  // camera never goes nearer the poles than these.
  readonly minPolarAngleDegrees: number
  readonly maxPolarAngleDegrees: number
}

export const cameraLimitConfig: CameraLimitConfig = {
  minHomeDistanceRatio: 0.5,
  maxHomeDistanceRatio: 2.5,
  minPolarAngleDegrees: 15,
  maxPolarAngleDegrees: 165,
}

// The resolution every product's cameras are authored at, the project's
// render resolution. The aspect is computed from it, never typed as a
// decimal: the exporter writes the same double (width / height).
export const AUTHORED_CAMERA_RESOLUTION = {
  width: 1600,
  height: 1422,
} as const

export const authoredCameraAspect: number =
  AUTHORED_CAMERA_RESOLUTION.width / AUTHORED_CAMERA_RESOLUTION.height
