// The stage camera's pure geometry: the orbit view of an authored camera,
// and the orbit angles of a camera position around a target. Vectors are
// readonly tuples; exact values, no rounding. The spherical conventions are
// the ones camera-controls and three's Spherical use: azimuth around +Y
// measured from +Z, polar from +Y. The module imports nothing at runtime,
// so the build-time scripts run it straight from its .ts file.

export type Vec3 = readonly [number, number, number]

// The authored facts of a glTF camera in stage space: its world position,
// its world forward unit vector, and its vertical field of view in radians.
export type AuthoredCameraRay = {
  readonly position: Vec3
  readonly forward: Vec3
  readonly fovY: number
}

// The point one view orbits, and what that point is, in the words a problem
// names it by ('the model center', 'the HS_driver anchor'). Every view
// carries one: the rule that chooses it lives in ./pivot.
export type ViewPivot = {
  readonly point: Vec3
  readonly subject: string
}

// One authored view of a product: the view id the camera carries after the
// CAM_ prefix ('home', 'driver'), the identity a problem names, the
// camera's authored ray, and the pivot its orbit target is projected from.
export type NamedCameraRay = {
  readonly id: string
  readonly ray: AuthoredCameraRay
  readonly pivot: ViewPivot
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
// to the given pivot (the model center for home, or a hotspot anchor at rest
// for a close-up), so the controls orbit the subject while holding the
// authored direction. The same function serves the home view and every
// close-up view.
export function orbitViewOfAuthoredCamera(authored: AuthoredCameraRay, pivot: Vec3): OrbitView {
  return {
    position: authored.position,
    target: add(authored.position, scale(authored.forward, pivotDepthOf(authored, pivot))),
    fovY: authored.fovY,
  }
}

// How far ahead of the camera the pivot projects onto its view ray, along
// the authored forward: positive in front of the eye, zero beside it,
// negative behind it. The orbit target is the camera position moved by
// exactly this depth, so the geometry rule reads the same number the
// target is built from.
export function pivotDepthOf(authored: AuthoredCameraRay, pivot: Vec3): number {
  return dot(sub(pivot, authored.position), authored.forward)
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
