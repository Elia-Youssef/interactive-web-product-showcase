// The vector arithmetic and the roll-free view basis the camera rules
// share: the basis the controls rebuild every view with, right from the
// view direction crossed with world up, up from right crossed with the
// view direction. One module, so the roll rule and the home fit read the
// same basis with the same degenerate case.
import type { Vec3 } from '../src/lib/camera/frame.ts'

// The world up of glTF space, the up the controls rebuild every view from.
export const WORLD_UP: Vec3 = [0, 1, 0]

// How short the cross of a view direction with world up may get before the
// view counts as straight along world up: such a view has no roll-free
// basis, and the polar limits own that camera.
const DEGENERATE_RIGHT_LENGTH = 1e-9

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function lengthOf(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}

// The unit vector along a direction; a zero direction is no direction.
export function unitOf(vector: Vec3): Vec3 {
  const length = lengthOf(vector)
  if (length === 0) {
    throw new Error('a view direction cannot be the zero vector')
  }
  return scale(vector, 1 / length)
}

// The roll-free basis of a unit view direction: its right and up, or null
// for a view straight along world up.
export function rollFreeBasisOf(forward: Vec3): { readonly right: Vec3; readonly up: Vec3 } | null {
  const right = cross(forward, WORLD_UP)
  const length = lengthOf(right)
  if (length < DEGENERATE_RIGHT_LENGTH) {
    return null
  }
  const unitRight = scale(right, 1 / length)
  return { right: unitRight, up: cross(unitRight, forward) }
}
