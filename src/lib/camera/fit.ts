// The camera framing rule of the stage: the distance at which a perspective
// camera sees a bounding sphere whole. Pure trigonometry, exact to the float:
// rounding or display units never enter lib.

export type SphereView = {
  // The radius of the bounding sphere to fit, in scene units.
  readonly radius: number
  // The camera's vertical field of view, in radians.
  readonly fovY: number
  // The viewport aspect ratio, width over height.
  readonly aspect: number
}

// The distance from the sphere's center at which the sphere touches the
// frustum without being cut by it. The binding constraint is the narrower of
// the two half view angles: the vertical one for a wide viewport, the
// horizontal one for a tall one. The tangent ray from the camera to the
// sphere makes the half angle there, so the distance is radius over its sine.
export function fitDistance(view: SphereView): number {
  const halfFovY = view.fovY / 2
  const halfFovX = Math.atan(Math.tan(halfFovY) * view.aspect)
  const bindingHalfFov = Math.min(halfFovY, halfFovX)
  return view.radius / Math.sin(bindingHalfFov)
}
