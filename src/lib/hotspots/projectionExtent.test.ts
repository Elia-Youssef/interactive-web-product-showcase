import { describe, expect, it } from 'vitest'
import { projectBoxExtent } from './projection'
import { cameraAt, SQUARE, straightCamera } from './projectionFixtures'

// The box extent projection against the same camera fixtures the point
// projection holds its math against: a quarter-turn camera on +Z, whose
// half extent at a view depth equals that depth, so the table names its
// boxes in plain fractions of the frustum slice.

describe('projectBoxExtent', () => {
  it('answers the rect that covers the eight corners of the box', () => {
    const target = { left: 0, top: 0, right: 0, bottom: 0 }
    // A box of half extent 0.5 around the origin, in the quarter-turn camera
    // on +Z: the widest projections come from the near face's corners, at
    // view depth 2.5, where the half extent 0.5 maps to a fifth of the half
    // box on each axis.
    const onStage = projectBoxExtent(
      { minX: -0.5, minY: -0.5, minZ: -0.5, maxX: 0.5, maxY: 0.5, maxZ: 0.5 },
      straightCamera,
      SQUARE,
      target,
    )

    expect(onStage).toBe(true)
    expect(target.left).toBeCloseTo(320, 6)
    expect(target.top).toBeCloseTo(320, 6)
    expect(target.right).toBeCloseTo(480, 6)
    expect(target.bottom).toBeCloseTo(480, 6)
  })

  it('answers the rect of the corners in front when the camera sits inside the box', () => {
    const target = { left: 0, top: 0, right: 0, bottom: 0 }
    // The box spans the camera plane: the near half's corners project, the
    // far half's do not, and the answer covers only the ones that do.
    const onStage = projectBoxExtent(
      { minX: -0.5, minY: -0.5, minZ: -0.5, maxX: 0.5, maxY: 0.5, maxZ: 0.5 },
      cameraAt({ x: 0, y: 0, z: 0.25 }, { x: 0, y: 0, z: -1 }, 1),
      SQUARE,
      target,
    )

    expect(onStage).toBe(true)
    // The front face sits 0.75 from the camera with half extent 0.5: its
    // corners sit at two thirds of the half box on each axis.
    const inset = (800 * (1 - 0.5 / 0.75)) / 2
    expect(target.left).toBeCloseTo(inset, 6)
    expect(target.right).toBeCloseTo(800 - inset, 6)
    expect(target.top).toBeCloseTo(inset, 6)
    expect(target.bottom).toBeCloseTo(800 - inset, 6)
  })

  it('answers false for a box fully behind the camera and leaves the target alone', () => {
    const target = { left: 7, top: 8, right: 9, bottom: 10 }
    const onStage = projectBoxExtent(
      { minX: -0.5, minY: -0.5, minZ: 4, maxX: 0.5, maxY: 0.5, maxZ: 5 },
      straightCamera,
      SQUARE,
      target,
    )

    expect(onStage).toBe(false)
    expect(target).toEqual({ left: 7, top: 8, right: 9, bottom: 10 })
  })
})
