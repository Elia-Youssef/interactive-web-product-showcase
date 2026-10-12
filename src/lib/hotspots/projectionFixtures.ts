// The camera matrices the projection tests build, in one place so the point
// projection's table and the box extent's table hold their math against the
// same definitions: a perspective view matrix from an eye, a target and the
// +Y up the stage camera keeps, the standard perspective projection from
// fovY, aspect, near and far, and the quarter-turn projection whose x and y
// scales are exactly 1, so the tables can name points in plain multiples of
// the view depth.

import type { CameraMatrices, StageBox, WorldPoint } from './projection'

// The look-at view matrix (world to camera), column-major like
// Matrix4.elements: the camera at eye looking at target, up +Y.
export function lookAtView(eye: WorldPoint, target: WorldPoint): number[] {
  let zx = eye.x - target.x
  let zy = eye.y - target.y
  let zz = eye.z - target.z
  const zLength = Math.hypot(zx, zy, zz)
  zx /= zLength
  zy /= zLength
  zz /= zLength
  // x = up cross z, with up = (0, 1, 0)
  const xx = 1 * zz - 0 * zy
  const xy = 0 * zx - 0 * zz
  const xz = 0 * zy - 1 * zx
  const xLength = Math.hypot(xx, xy, xz)
  const nx = xx / xLength
  const ny = xy / xLength
  const nz = xz / xLength
  // y = z cross x
  const yx = zy * nz - zz * ny
  const yy = zz * nx - zx * nz
  const yz = zx * ny - zy * nx
  return [
    nx,
    yx,
    zx,
    0,
    ny,
    yy,
    zy,
    0,
    nz,
    yz,
    zz,
    0,
    -(nx * eye.x + ny * eye.y + nz * eye.z),
    -(yx * eye.x + yy * eye.y + yz * eye.z),
    -(zx * eye.x + zy * eye.y + zz * eye.z),
    1,
  ]
}

// The standard perspective projection, column-major.
export function perspectiveProjection(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): number[] {
  const f = 1 / Math.tan(fovY / 2)
  return [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ]
}

// The projection of a quarter-turn field of view, written out with its
// x and y scale exactly 1: tan(pi/4) is not exactly 1 in floats, and the
// tables' edge cases are edge cases only in exact arithmetic.
export function quarterTurnProjection(aspect: number, near: number, far: number): number[] {
  return [
    1 / aspect,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ]
}

export const NEAR = 0.1
export const FAR = 100

export function cameraAt(eye: WorldPoint, target: WorldPoint, aspect: number): CameraMatrices {
  return {
    viewMatrix: lookAtView(eye, target),
    projectionMatrix: quarterTurnProjection(aspect, NEAR, FAR),
  }
}

export const SQUARE: StageBox = { width: 800, height: 800 }
export const WIDE: StageBox = { width: 1200, height: 600 }
export const WIDE_ASPECT = WIDE.width / WIDE.height

export const straightCamera = cameraAt({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 0 }, 1)
// The view depth of the frustum slice the tables' points sit in.
export const DEPTH = 3
