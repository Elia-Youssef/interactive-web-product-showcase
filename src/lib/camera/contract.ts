// The camera contract of a product, as one rule assembly: every authored
// view, the model frame and the manifest's authored distance limits go in,
// and the check comes out: every problem the authored camera data has, and
// the resolved distance and polar limits the check ran, so the caller
// presents exactly what it checked. An empty problem list is the contract
// holding.
//
// The runtime plan and the build-time validate step run this one assembly
// over the same view set, so a view that passes validate is a view the
// runtime presents, and a breach fails the build instead of the browser.

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
  ViewOrbit,
} from './limits'
import type { CameraLimitConfig } from './config'
import type { FrameSpan } from './frame'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from './view'
import type { NamedCameraRay } from './view'

// The facts one contract check reads: every authored view of the product
// (the home view among them) as a named camera ray in the space the frame
// is measured in, the id of the home view the fallback limits derive from,
// the frame of the model the views look at, the distance limits the
// manifest authors, and the limit configuration of the project.
export type CameraContractInput = {
  readonly views: readonly NamedCameraRay[]
  readonly homeId: string
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

// Checks every authored view against the distance and polar limits: each
// view outside the distance limits, the minimum distance inside the model,
// each view outside the polar limits. The home view is one of the views and
// answers to the same rules; it alone sets the fallback distance limits.
// A close-up the limits would clamp away is as broken as a home that fails
// them, so no view is exempt.
export function cameraContractProblems(input: CameraContractInput): CameraContractCheck {
  const orbits = input.views.map((view) => viewOrbitOf(view, input.frame))
  const home = orbits.find((orbit) => orbit.id === input.homeId)
  if (home === undefined) {
    // Both callers resolve the home view before the check and fail a
    // product without one by its own rule, so a view list without it is a
    // caller contract break, not authored data breaking a rule.
    throw new Error(`internal error: the contract views hold no home view '${input.homeId}'`)
  }
  const distanceRange = resolvedDistanceLimits(input.authoredDistanceLimits, home.distance, {
    minRatio: input.limits.minHomeDistanceRatio,
    maxRatio: input.limits.maxHomeDistanceRatio,
  })
  const polarRange = resolvedPolarRange(input.limits)
  return {
    problems: [
      ...distanceLimitProblems(distanceRange, orbits, input.frame.radius),
      ...polarLimitProblems(polarRange, orbits),
    ],
    distanceRange,
    polarRange,
  }
}

// The orbit numbers of one view around the frame center: the orbit target
// projected from the view's ray, then the distance and polar angle the
// rules read.
function viewOrbitOf(view: NamedCameraRay, frame: FrameSpan): ViewOrbit {
  const orbit = orbitViewOfAuthoredCamera(view.ray, frame.center)
  const angles = orbitAnglesOf(orbit.position, orbit.target)
  return { id: view.id, distance: angles.distance, polar: angles.polar }
}
