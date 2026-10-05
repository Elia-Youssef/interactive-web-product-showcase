// The camera contract of a product, as one rule assembly: every authored
// view with its pivot, the model's bounds and the manifest's authored
// distance limits go in, and the check comes out: the contract holding,
// with the resolved distance and polar limits the check ran, so the caller
// presents exactly what it checked, or every problem the authored camera
// data has.
//
// The runtime plan and the build-time validate step run this one assembly
// over the same view set, so a view that passes validate is a view the
// runtime presents, and a breach fails the build instead of the browser.

import {
  distanceLimitProblems,
  polarLimitProblems,
  reachLimitProblems,
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
import { farthestPointFrom } from './frame'
import type { ModelBounds } from './frame'
import { viewGeometryProblems } from './geometry'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from './view'
import type { NamedCameraRay } from './view'

// The facts one contract check reads: the product the problems name, every
// authored view of it (the home view among them) as a named camera ray
// with its pivot, in the space the bounds are measured in, the id of the
// home view the fallback limits derive from, the bounds of the model the
// views look at, the distance limits the manifest authors, and the limit
// configuration of the project.
export type CameraContractInput = {
  readonly product: string
  readonly views: readonly NamedCameraRay[]
  readonly homeId: string
  readonly bounds: ModelBounds
  readonly authoredDistanceLimits: AuthoredDistanceLimits
  readonly limits: CameraLimitConfig
}

// The result of one contract check. The contract holds with the distance
// and polar limits the check resolved and ran, or it is broken with every
// rule the authored camera data breaks, in one fixed order with the values
// named. A broken check carries no limits: a home view whose geometry is
// broken has no orbit distance to derive them from.
export type CameraContractCheck =
  | {
      readonly kind: 'holds'
      readonly distanceRange: DistanceRange
      readonly polarRange: PolarRange
    }
  | { readonly kind: 'broken'; readonly problems: readonly CameraLimitProblem[] }

// Checks every authored view's geometry, then every view with a sound
// geometry against the limits: each view outside the distance limits, each
// view whose reach the minimum distance does not exceed, each view outside
// the polar limits. The home view is one of the views and answers to the
// same rules; it alone sets the fallback distance limits, so a home whose
// geometry is broken leaves no limit to derive and no limit rule runs: its
// geometry problems already break the contract. A view whose geometry is
// broken has no orbit for the limit rules to read, so only its geometry
// problems name it. A close-up the limits would clamp away is as broken as
// a home that fails them, so no view is exempt.
export function cameraContractProblems(input: CameraContractInput): CameraContractCheck {
  if (!input.views.some((view) => view.id === input.homeId)) {
    // Both callers resolve the home view before the check and fail a
    // product without one by its own rule, so a view list without it is a
    // caller contract break, not authored data breaking a rule.
    throw new Error(`internal error: the contract views hold no home view '${input.homeId}'`)
  }
  const geometry: CameraLimitProblem[] = []
  const orbits: ViewOrbit[] = []
  for (const view of input.views) {
    const problems = viewGeometryProblems(view)
    if (problems.length > 0) {
      geometry.push(...problems)
    } else {
      orbits.push(viewOrbitOf(view, input.bounds))
    }
  }
  const home = orbits.find((orbit) => orbit.id === input.homeId)
  if (home === undefined) {
    return { kind: 'broken', problems: geometry }
  }
  const distanceRange = resolvedDistanceLimits(input.authoredDistanceLimits, home.distance, {
    minRatio: input.limits.minHomeDistanceRatio,
    maxRatio: input.limits.maxHomeDistanceRatio,
  })
  const polarRange = resolvedPolarRange(input.limits)
  const problems = [
    ...geometry,
    ...distanceLimitProblems(distanceRange, orbits),
    ...reachLimitProblems(distanceRange, orbits, input.product),
    ...polarLimitProblems(polarRange, orbits),
  ]
  return problems.length > 0
    ? { kind: 'broken', problems }
    : { kind: 'holds', distanceRange, polarRange }
}

// The orbit numbers of one view with a sound geometry: the orbit target
// projected from the view's pivot onto its ray, the distance and polar
// angle the limits read, and the model's reach from that target.
function viewOrbitOf(view: NamedCameraRay, bounds: ModelBounds): ViewOrbit {
  const orbit = orbitViewOfAuthoredCamera(view.ray, view.pivot.point)
  const angles = orbitAnglesOf(orbit.position, orbit.target)
  return {
    id: view.id,
    distance: angles.distance,
    polar: angles.polar,
    reach: farthestPointFrom(bounds, orbit.target),
    pivot: view.pivot.subject,
  }
}
