import { describe, expect, it } from 'vitest'
import type { CameraMatrices, StageBox, WorldPoint } from './projection'
import { projectToStage } from './projection'

// The test builds its own matrices, so the math is held against its
// definitions instead of against the viewer's camera: a perspective view
// matrix from an eye, a target and the +Y up the stage camera keeps, and the
// standard perspective projection from fovY, aspect, near and far.

// The look-at view matrix (world to camera), column-major like
// Matrix4.elements: the camera at eye looking at target, up +Y.
function lookAtView(eye: WorldPoint, target: WorldPoint): number[] {
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
function perspectiveProjection(fovY: number, aspect: number, near: number, far: number): number[] {
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
// table's edge cases are edge cases only in exact arithmetic.
function quarterTurnProjection(aspect: number, near: number, far: number): number[] {
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

// A quarter-turn field of view keeps the half-extent of the view frustum at
// the depth of the point equal to that depth (times the aspect), so the
// table below can name its points in plain multiples of the depth.
const NEAR = 0.1
const FAR = 100

function cameraAt(eye: WorldPoint, target: WorldPoint, aspect: number): CameraMatrices {
  return {
    viewMatrix: lookAtView(eye, target),
    projectionMatrix: quarterTurnProjection(aspect, NEAR, FAR),
  }
}

// The square stage of the table: any point with |ndc| at 1 maps to the box
// edge, so the expected pixels are the box itself.
const SQUARE: StageBox = { width: 800, height: 800 }
const WIDE: StageBox = { width: 1200, height: 600 }
const WIDE_ASPECT = WIDE.width / WIDE.height

const straightCamera = cameraAt({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 0 }, 1)
const depth = 3 // the view depth of the frustum slice the table's points sit in

type Case = {
  readonly name: string
  readonly point: WorldPoint
  readonly stage: StageBox
  readonly camera: CameraMatrices
  readonly expected: { readonly x: number; readonly y: number }
  readonly inFront: boolean
  // The box verdict is asserted only for points in front of the camera: a
  // point behind it has no readable coordinates, and the visibility rule
  // never reads them.
}

const cases: readonly Case[] = [
  {
    name: 'center',
    point: { x: 0, y: 0, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 400, y: 400 },
    inFront: true,
  },
  {
    name: 'left edge',
    point: { x: -depth, y: 0, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 0, y: 400 },
    inFront: true,
  },
  {
    name: 'right edge',
    point: { x: depth, y: 0, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 800, y: 400 },
    inFront: true,
  },
  {
    name: 'top edge',
    point: { x: 0, y: depth, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 400, y: 0 },
    inFront: true,
  },
  {
    name: 'bottom edge',
    point: { x: 0, y: -depth, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 400, y: 800 },
    inFront: true,
  },
  {
    name: 'outside the left edge',
    point: { x: -1.2 * depth, y: 0, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: -80, y: 400 },
    inFront: true,
  },
  {
    name: 'outside the bottom edge',
    point: { x: 0, y: -1.5 * depth, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 400, y: 1000 },
    inFront: true,
  },
  {
    name: 'behind the camera',
    point: { x: 0, y: 0, z: 3 + 1 },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: Number.NaN, y: Number.NaN },
    inFront: false,
  },
  {
    name: 'on the camera plane',
    point: { x: 0, y: 0, z: 3 },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: Number.NaN, y: Number.NaN },
    inFront: false,
  },
  {
    name: 'on the near plane',
    point: { x: 0, y: 0, z: 3 - NEAR },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 400, y: 400 },
    inFront: true,
  },
  {
    name: 'off the optical axis at depth, off-center camera',
    point: { x: depth / 2, y: 0, z: 3 - depth },
    stage: SQUARE,
    camera: straightCamera,
    expected: { x: 600, y: 400 },
    inFront: true,
  },
  {
    name: 'a wide box maps the frustum edge to its own width',
    point: { x: depth * WIDE_ASPECT, y: 0, z: 3 - depth },
    stage: WIDE,
    camera: cameraAt({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 0 }, WIDE_ASPECT),
    expected: { x: 1200, y: 300 },
    inFront: true,
  },
]

describe('projectToStage', () => {
  for (const entry of cases) {
    it(`projects ${entry.name}`, () => {
      const projection = projectToStage(entry.point, entry.camera, entry.stage)

      expect(projection.inFront).toBe(entry.inFront)
      if (entry.inFront) {
        expect(projection.x).toBeCloseTo(entry.expected.x, 9)
        expect(projection.y).toBeCloseTo(entry.expected.y, 9)
      }
    })
  }

  it('projects from an off-axis camera through its own view matrix', () => {
    // The camera sits at (3, 4, 5) looking at the origin: the origin must
    // land at the box center, whatever the eye is, because the view matrix
    // carries the whole transform.
    const camera = cameraAt({ x: 3, y: 4, z: 5 }, { x: 0, y: 0, z: 0 }, 1)
    const projection = projectToStage({ x: 0, y: 0, z: 0 }, camera, SQUARE)

    expect(projection.inFront).toBe(true)
    expect(projection.x).toBeCloseTo(400, 6)
    expect(projection.y).toBeCloseTo(400, 6)
  })

  it('keeps the projection exact for a point just inside the edge', () => {
    // No rounding: a 1/1000 frustum step inside the edge is 1/1000 of a
    // half-box in pixels, and the answer carries it.
    const projection = projectToStage(
      { x: 0.999 * depth, y: 0, z: 3 - depth },
      straightCamera,
      SQUARE,
    )

    expect(projection.x).toBeCloseTo(799.6, 9)
  })

  it('lands the general matrix projection a hair past the edge it touches', () => {
    // A tan-derived quarter-turn matrix carries a 1 ulp scale error, so the
    // exact edge maps a hair outside the box. That is the honest answer of
    // the exact math: the rule hides the marker, and no epsilon papers over
    // the distance between the floats and the ideal edge.
    const generalCamera: CameraMatrices = {
      viewMatrix: lookAtView({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 0 }),
      projectionMatrix: perspectiveProjection(Math.PI / 2, 1, NEAR, FAR),
    }
    const projection = projectToStage({ x: -depth, y: 0, z: 3 - depth }, generalCamera, SQUARE)

    expect(projection.x).toBeLessThan(0)
    expect(projection.x).toBeGreaterThan(-1e-9)
  })
})
