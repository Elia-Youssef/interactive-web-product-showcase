import { describe, expect, it } from 'vitest'
import type { CameraMatrices, StageBox, StageProjectionTarget, WorldPoint } from './projection'
import { projectToStage } from './projection'
import {
  cameraAt,
  DEPTH as depth,
  FAR,
  lookAtView,
  NEAR,
  perspectiveProjection,
  SQUARE,
  straightCamera,
  WIDE,
  WIDE_ASPECT,
} from './projectionFixtures'

// The point projection's own table, against the camera fixtures the box
// extent's table shares: every case names its point in plain multiples of
// the view depth, and a quarter-turn camera maps the frustum edge to the
// box edge. Each case gets its own targets prefilled with NaN, so a field
// the projection left unwritten fails the case instead of carrying a
// earlier case's answer.

import type { ClipSpaceTarget } from './projection'

// A target prefilled with the wrong answer of every kind: NaN for the
// numbers, the negated expectation for the flag.
function freshTarget(inFront: boolean): StageProjectionTarget {
  return { x: Number.NaN, y: Number.NaN, inFront: !inFront }
}

function freshClip(): ClipSpaceTarget {
  return { x: Number.NaN, y: Number.NaN, w: Number.NaN }
}

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
      const target = freshTarget(entry.inFront)
      projectToStage(entry.point, entry.camera, entry.stage, target, freshClip())

      expect(target.inFront).toBe(entry.inFront)
      if (entry.inFront) {
        expect(target.x).toBeCloseTo(entry.expected.x, 9)
        expect(target.y).toBeCloseTo(entry.expected.y, 9)
      }
    })
  }

  it('projects from an off-axis camera through its own view matrix', () => {
    // The camera sits at (3, 4, 5) looking at the origin: the origin must
    // land at the box center, whatever the eye is, because the view matrix
    // carries the whole transform.
    const camera = cameraAt({ x: 3, y: 4, z: 5 }, { x: 0, y: 0, z: 0 }, 1)
    const target = freshTarget(true)
    projectToStage({ x: 0, y: 0, z: 0 }, camera, SQUARE, target, freshClip())

    expect(target.inFront).toBe(true)
    expect(target.x).toBeCloseTo(400, 6)
    expect(target.y).toBeCloseTo(400, 6)
  })

  it('keeps the projection exact for a point just inside the edge', () => {
    // No rounding: a 1/1000 frustum step inside the edge is 1/1000 of a
    // half-box in pixels, and the answer carries it.
    const target = freshTarget(true)
    projectToStage(
      { x: 0.999 * depth, y: 0, z: 3 - depth },
      straightCamera,
      SQUARE,
      target,
      freshClip(),
    )

    expect(target.x).toBeCloseTo(799.6, 9)
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
    const target = freshTarget(true)
    projectToStage({ x: -depth, y: 0, z: 3 - depth }, generalCamera, SQUARE, target, freshClip())

    expect(target.x).toBeLessThan(0)
    expect(target.x).toBeGreaterThan(-1e-9)
  })
})
