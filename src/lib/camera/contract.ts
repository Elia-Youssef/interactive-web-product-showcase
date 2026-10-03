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
import { viewGeometryProblems } from './geometry'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from './view'
import type { AuthoredCameraRay, NamedCameraRay } from './view'

// The facts one contract check reads: the home view as a camera ray in the
// space the frame is measured in, every authored view beside it in the same
// space, named by its view id, the frame of the model the views look at,
// the distance limits the manifest authors, and the limit configuration of
// the project. The geometry rule checks every view; the limit rules check
// the home view.
export type CameraContractInput = {
  readonly views: readonly NamedCameraRay[]
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

// Checks every authored view's geometry, then the authored home view
// against the distance and polar limits: the home view outside the distance
// limits, the minimum distance inside the model, the home view outside the
// polar limits. A home view whose geometry is broken has no orbit to hold
// to the limits, so its limit rules are not run on it; its geometry
// problems already fail the contract.
export function cameraContractProblems(input: CameraContractInput): CameraContractCheck {
  const center = input.frame.center
  const geometry = input.views.flatMap((view) => viewGeometryProblems(view, center))
  const view = orbitViewOfAuthoredCamera(input.home, center)
  const angles = orbitAnglesOf(view.position, view.target)
  const distanceRange = resolvedDistanceLimits(input.authoredDistanceLimits, angles.distance, {
    minRatio: input.limits.minHomeDistanceRatio,
    maxRatio: input.limits.maxHomeDistanceRatio,
  })
  const polarRange = resolvedPolarRange(input.limits)
  const homeSound = viewGeometryProblems(homeView(input.home), center).length === 0
  return {
    problems: [
      ...geometry,
      ...(homeSound
        ? [
            ...distanceLimitProblems(distanceRange, angles.distance, input.frame.radius),
            ...polarLimitProblems(polarRange, angles.polar),
          ]
        : []),
    ],
    distanceRange,
    polarRange,
  }
}

// The home ray as a named view, for the geometry rule's verdict on it.
function homeView(ray: AuthoredCameraRay): NamedCameraRay {
  return { id: 'home', ray }
}
