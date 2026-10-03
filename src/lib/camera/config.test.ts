// The camera contract's authored data: the resolution the aspect is
// computed from (never typed as a decimal), and the limit values both the
// runtime and the validate step read.
import { describe, expect, it } from 'vitest'
import { AUTHORED_CAMERA_RESOLUTION, authoredCameraAspect, cameraLimitConfig } from './config'

describe('the authored camera data', () => {
  it('carries the project resolution and its computed aspect', () => {
    expect(AUTHORED_CAMERA_RESOLUTION).toEqual({ width: 1600, height: 1422 })
    expect(authoredCameraAspect).toBe(
      AUTHORED_CAMERA_RESOLUTION.width / AUTHORED_CAMERA_RESOLUTION.height,
    )
    expect(authoredCameraAspect).toBe(1600 / 1422)
  })

  it('carries the home distance ratios and polar degrees', () => {
    expect(cameraLimitConfig).toEqual({
      minHomeDistanceRatio: 0.5,
      maxHomeDistanceRatio: 2.5,
      minPolarAngleDegrees: 15,
      maxPolarAngleDegrees: 165,
    })
  })
})
