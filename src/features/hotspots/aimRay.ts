import type { Raycaster, Vector3 } from 'three'

// The one setup of the ray from the camera to an anchor. three's raycaster
// requires a unit direction (Raycaster.set: "direction is assumed to be
// normalized"), and the mesh raycast's bounding-sphere pretest builds its
// rejection on that assumption (Mesh.raycast rejects through
// Ray.intersectSphere, whose perpendicular distance grows for a shorter
// direction), so a direction shorter than one unit drops real occluders
// before any triangle test. An anchor nearer than 1 m to the camera hands
// the raycaster exactly such a direction. The length is therefore taken
// first, the direction is normalized in the raycaster's own ray, and far
// carries the length the ray must stop at.

// Points the raycaster from the origin at the target and stops it there,
// with the unit direction the raycaster's math assumes. Returns the
// origin-to-target distance, the ray's far bound. An origin sitting on its
// target fails loudly: a zero aim has no direction to normalize, and cast
// on unchanged it would read as NaN.
export function aimRay(raycaster: Raycaster, origin: Vector3, target: Vector3): number {
  const direction = raycaster.ray.direction
  direction.subVectors(target, origin)
  const length = direction.length()
  if (length === 0) {
    throw new Error('aimRay: the target sits on the origin: a zero aim has no direction')
  }
  direction.divideScalar(length)
  raycaster.ray.origin.copy(origin)
  raycaster.far = length
  return length
}
