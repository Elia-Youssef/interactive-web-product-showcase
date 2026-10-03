// The stage camera's pure geometry: the orbit view of an authored camera,
// and the orbit angles of a camera position around a target. Vectors are
// readonly tuples; exact values, no rounding. The spherical conventions are
// the ones camera-controls and three's Spherical use: azimuth around +Y
// measured from +Z, polar from +Y.

export type Vec3 = readonly [number, number, number]

// The authored facts of a glTF camera in stage space: its world position,
// its world forward unit vector, and its vertical field of view in radians.
export type AuthoredCameraRay = {
  readonly position: Vec3
  readonly forward: Vec3
  readonly fovY: number
}

// One authored view of a product: the view id the camera carries after the
// CAM_ prefix ('home', 'driver'), the identity a limit problem names, and
// the camera's authored ray.
export type NamedCameraRay = {
  readonly id: string
  readonly ray: AuthoredCameraRay
}

// The orbit view the controls present for an authored camera: where the
// camera sits, what it orbits around, and the vertical fov it keeps.
export type OrbitView = {
  readonly position: Vec3
  readonly target: Vec3
  readonly fovY: number
}

// The orbit state of a camera position around a target.
export type OrbitAngles = {
  readonly azimuth: number
  readonly polar: number
  readonly distance: number
}

// The orbit view of an authored camera: the authored position and vertical
// fov are kept, and the target is the point on the authored view ray closest
// to the model center, so the controls orbit the product while holding the
// authored direction. The same function serves the home view and every
// close-up view.
export function orbitViewOfAuthoredCamera(authored: AuthoredCameraRay, center: Vec3): OrbitView {
  const along = dot(sub(center, authored.position), authored.forward)
  return {
    position: authored.position,
    target: add(authored.position, scale(authored.forward, along)),
    fovY: authored.fovY,
  }
}

// The orbit angles of a camera position around a target: the azimuth from
// +Z, the polar angle from +Y, and the distance between the two points. The
// position must differ from the target, so the angles exist.
export function orbitAnglesOf(position: Vec3, target: Vec3): OrbitAngles {
  const [dx, dy, dz] = sub(position, target)
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return {
    azimuth: Math.atan2(dx, dz),
    polar: Math.acos(clampUnit(dy / distance)),
    distance,
  }
}

// The camera position the orbit angles and distance name around a target,
// inverting orbitAnglesOf: the same point comes back from the same state.
export function positionOfOrbitAngles(
  azimuth: number,
  polar: number,
  distance: number,
  target: Vec3,
): Vec3 {
  const sinPolar = Math.sin(polar)
  return [
    target[0] + distance * sinPolar * Math.sin(azimuth),
    target[1] + distance * Math.cos(polar),
    target[2] + distance * sinPolar * Math.cos(azimuth),
  ]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, -1), 1)
}
