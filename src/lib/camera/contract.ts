// The camera contract of a product, as one rule assembly: the authored
// home view, the model frame and the manifest's authored distance limits
// go in, and the check comes out: every problem the authored camera data
// has, and the resolved distance and polar limits the check ran, so the
// caller presents exactly what it checked. An empty problem list is the
// contract holding.
//
// The runtime plan and the build-time validate step run this one assembly,
// so a home view that passes validate is the home view the runtime builds,
// and a breach fails the build instead of the browser.

import {
  distanceLimitProblems,
  polarLimitProblems,
  resolvedDistanceLimits,
  resolvedPolarRange,
} from './limits'
import type {
  AuthoredDistanceLimits,
  CameraLimitProblem,
  DistanceRange,
  PolarRange,
} from './limits'
import type { CameraLimitConfig } from './config'
import type { FrameSpan } from './frame'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from './view'
import type { AuthoredCameraRay } from './view'

// The facts one contract check reads: the home view as a camera ray in the
// space the frame is measured in, every authored camera ray beside it in
// the same space, the frame of the model the views look at, the distance
// limits the manifest authors, and the limit configuration of the project.
// The rules below check the home view; the ray list is the input the
// every-view rules widen when they join, so their merge adds rules without
// reshaping the input.
export type CameraContractInput = {
  readonly views: readonly AuthoredCameraRay[]
  readonly home: AuthoredCameraRay
  readonly frame: FrameSpan
  readonly authoredDistanceLimits: AuthoredDistanceLimits
  readonly limits: CameraLimitConfig
}

// The result of one contract check: every rule the authored camera data
// breaks, in one fixed order with the values named, and the distance and
// polar limits the check resolved.
export type CameraContractCheck = {
  readonly problems: readonly CameraLimitProblem[]
  readonly distanceRange: DistanceRange
  readonly polarRange: PolarRange
}

// Checks the authored home view against the distance and polar limits: the
// home view outside the distance limits, the minimum distance inside the
// model, the home view outside the polar limits.
export function cameraContractProblems(input: CameraContractInput): CameraContractCheck {
  const view = orbitViewOfAuthoredCamera(input.home, input.frame.center)
  const angles = orbitAnglesOf(view.position, view.target)
  const distanceRange = resolvedDistanceLimits(input.authoredDistanceLimits, angles.distance, {
    minRatio: input.limits.minHomeDistanceRatio,
    maxRatio: input.limits.maxHomeDistanceRatio,
  })
  const polarRange = resolvedPolarRange(input.limits)
  return {
    problems: [
      ...distanceLimitProblems(distanceRange, angles.distance, input.frame.radius),
      ...polarLimitProblems(polarRange, angles.polar),
    ],
    distanceRange,
    polarRange,
  }
}
