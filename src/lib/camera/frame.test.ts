// The frame math, over tables of boxes and transforms. The agreement with
// three's own measure lives in tests/e2e/cameraFrame.test.ts, where real
// three scenes are built; this suite pins the pure function's own
// semantics: the union of the transformed corners and the box's
// circumscribed sphere.
import { describe, expect, it } from 'vitest'
import { frameSpanOfMeshBoxes } from './frame'
import type { MeshBox } from './frame'

const IDENTITY: MeshBox['matrix'] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function boxAt(min: [number, number, number], max: [number, number, number]): MeshBox {
  return { min, max, matrix: IDENTITY }
}

describe('frameSpanOfMeshBoxes', () => {
  it('frames one box by its center and half diagonal', () => {
    const span = frameSpanOfMeshBoxes([boxAt([0, 0, 0], [2, 2, 0])])
    expect(span.center).toEqual([1, 1, 0])
    expect(span.radius).toBe(Math.sqrt(8) * 0.5)
  })

  it('unions every box, not only the first', () => {
    const span = frameSpanOfMeshBoxes([boxAt([0, 0, 0], [1, 1, 1]), boxAt([3, -1, 0], [4, 0, 1])])
    expect(span.center).toEqual([2, 0, 0.5])
    expect(span.radius).toBeCloseTo(Math.sqrt(16 + 4 + 1) * 0.5, 15)
  })

  it('transforms the corners, so a rotated box spans its world bounds', () => {
    // A quarter turn about Z swaps the x and y extents.
    const quarterTurnAboutZ: MeshBox['matrix'] = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const span = frameSpanOfMeshBoxes([
      { min: [0, 0, 0], max: [2, 1, 1], matrix: quarterTurnAboutZ },
    ])
    expect(span.center).toEqual([-0.5, 1, 0.5])
    expect(span.radius).toBe(Math.sqrt(4 + 1 + 1) * 0.5)
  })

  it('translates with the matrix', () => {
    const shift: MeshBox['matrix'] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, -2, 3, 1]
    const span = frameSpanOfMeshBoxes([{ min: [0, 0, 0], max: [1, 1, 1], matrix: shift }])
    expect(span.center).toEqual([5.5, -1.5, 3.5])
  })

  it('scales with the matrix', () => {
    const double: MeshBox['matrix'] = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]
    const span = frameSpanOfMeshBoxes([{ min: [0, 0, 0], max: [1, 1, 1], matrix: double }])
    expect(span.radius).toBe(Math.sqrt(12) * 0.5)
  })

  it('skips an empty box the way three does, and frames the rest', () => {
    // A geometry with no positions yields an inverted (empty) box; three's
    // union skips it, and so must the frame, or the center turns NaN.
    const span = frameSpanOfMeshBoxes([
      { min: [1, 1, 1], max: [0, 0, 0], matrix: IDENTITY },
      boxAt([0, 0, 0], [2, 2, 0]),
    ])
    expect(span.center).toEqual([1, 1, 0])
    expect(span.radius).toBe(Math.sqrt(8) * 0.5)
  })

  it('frames a flat box: a collapsed side is not empty', () => {
    const span = frameSpanOfMeshBoxes([boxAt([-1, 0, -1], [1, 0, 1])])
    expect(span.center).toEqual([0, 0, 0])
    expect(span.radius).toBe(Math.sqrt(8) * 0.5)
  })

  it('throws on no boxes', () => {
    expect(() => frameSpanOfMeshBoxes([])).toThrow('a frame needs at least one mesh box')
  })

  it('throws when every box is empty', () => {
    expect(() =>
      frameSpanOfMeshBoxes([{ min: [1, 1, 1], max: [0, 0, 0], matrix: IDENTITY }]),
    ).toThrow('a frame needs at least one mesh box that bounds something')
  })
})
