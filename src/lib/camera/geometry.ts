// The geometry rule over every authored view: a view the controls would
// present must be a real orbit in front of the camera. A non-finite
// position, view direction or field of view, a field of view outside the
// open half turn, a pivot that projects behind the camera (the orbit
// target would sit behind the eye, so the camera would face away from what
// it orbits), a non-finite orbit target or distance, and an orbit target
// on the camera itself (a view ray that passes the pivot at a right angle)
// are problems of the authored data, reported with the camera and its
// pivot named, so the plan rejects them as values before any frame could
// present them.

import { CAMERA_PREFIX } from '../product/contractNames'
import type { CameraLimitProblem } from './limits'
import { orbitAnglesOf, orbitViewOfAuthoredCamera, pivotDepthOf } from './view'
import type { NamedCameraRay, Vec3 } from './view'

function isFiniteVec3(vector: Vec3): boolean {
  return vector.every((component) => Number.isFinite(component))
}

function problem(rule: string, view: NamedCameraRay, fact: string): CameraLimitProblem {
  return { rule, message: `the camera ${CAMERA_PREFIX}${view.id} ${fact}` }
}

// The geometry problems of one view around its pivot, in a fixed order. The
// authored facts come first; the orbit the controls derive from them is
// checked only when those are finite, so one broken fact is reported once
// instead of cascading.
export function viewGeometryProblems(view: NamedCameraRay): CameraLimitProblem[] {
  const { position, forward, fovY } = view.ray
  const authored = [
    ...(isFiniteVec3(position) ? [] : [problem('finite-views', view, 'has a non-finite position')]),
    ...(isFiniteVec3(forward)
      ? []
      : [problem('finite-views', view, 'has a non-finite view direction')]),
    ...(Number.isFinite(fovY)
      ? []
      : [problem('finite-views', view, 'has a non-finite field of view')]),
  ]
  if (authored.length > 0) {
    return authored
  }
  if (!(fovY > 0 && fovY < Math.PI)) {
    return [
      problem(
        'view-field-of-view',
        view,
        `has a field of view of ${fovY} rad, outside the open range (0, ${Math.PI})`,
      ),
    ]
  }
  return orbitProblems(view)
}

// The orbit the controls derive from sound authored facts: the pivot's
// depth along the view ray decides where the target lands, so a pivot
// behind the eye or beside it is named before the target is built.
function orbitProblems(view: NamedCameraRay): CameraLimitProblem[] {
  const { pivot } = view
  const depth = pivotDepthOf(view.ray, pivot.point)
  if (!Number.isFinite(depth)) {
    return [problem('finite-views', view, 'has a non-finite orbit target')]
  }
  if (depth < 0) {
    return [
      problem(
        'view-pivot-ahead',
        view,
        `orbits ${pivot.subject}, which projects ${-depth} behind it on its view ray`,
      ),
    ]
  }
  const orbit = orbitViewOfAuthoredCamera(view.ray, pivot.point)
  if (!isFiniteVec3(orbit.target)) {
    return [problem('finite-views', view, 'has a non-finite orbit target')]
  }
  const { distance } = orbitAnglesOf(orbit.position, orbit.target)
  if (!Number.isFinite(distance)) {
    return [problem('finite-views', view, 'has a non-finite orbit distance')]
  }
  if (distance === 0) {
    return [
      problem(
        'view-orbit-distance',
        view,
        `orbits its own position: its view ray passes ${pivot.subject} at a right angle`,
      ),
    ]
  }
  return []
}
