// The geometry rule over every authored view: a view the controls would
// present must be a real orbit. A non-finite position, view direction or
// field of view, a field of view outside the open half turn, a non-finite
// orbit target or distance, and an orbit target on the camera itself (a
// view ray that passes the model center at a right angle) are problems of
// the authored data, reported with the camera named, so the plan rejects
// them as values before any frame could present them.

import { CAMERA_PREFIX } from '../product/contractNames'
import type { CameraLimitProblem } from './limits'
import { orbitAnglesOf, orbitViewOfAuthoredCamera } from './view'
import type { NamedCameraRay, Vec3 } from './view'

function isFiniteVec3(vector: Vec3): boolean {
  return vector.every((component) => Number.isFinite(component))
}

function problem(rule: string, view: NamedCameraRay, fact: string): CameraLimitProblem {
  return { rule, message: `the camera ${CAMERA_PREFIX}${view.id} ${fact}` }
}

// The geometry problems of one view around the model center, in a fixed
// order. The authored facts come first; the orbit the controls derive from
// them is checked only when those are finite, so one broken fact is
// reported once instead of cascading.
export function viewGeometryProblems(view: NamedCameraRay, center: Vec3): CameraLimitProblem[] {
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
  const orbit = orbitViewOfAuthoredCamera(view.ray, center)
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
        'orbits its own position: its view ray passes the model center at a right angle',
      ),
    ]
  }
  return []
}
