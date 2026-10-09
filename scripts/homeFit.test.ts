// The home-fit math, table-driven: the projection a point takes through a
// roll-free camera at the authored aspect, the free share a frame keeps,
// the exact comparison with the margin, and the decimals a report needs to
// tell a share from the margin. Every expected value is computed by hand
// from the definitions, so the rule reads tested math.
import { describe, expect, it } from 'vitest'
import { decimalsApart, frameExtentOf, homeFitVerdictsOf } from './homeFit.ts'

// A camera at (0, 0, 4) looking down -Z with a 90 degree vertical fov: the
// tan of the half fov is 1, so a point's normalized coordinates are
// x = qx / (z * aspect) and y = qy / z, all divided by the depth 4.
const FORWARD: [number, number, number] = [0, 0, -1]
const POSITION: [number, number, number] = [0, 0, 4]
const RIGHT_ANGLE = Math.PI / 2

// The extent of a projection that must succeed.
function extentOf(...args: Parameters<typeof frameExtentOf>) {
  const extent = frameExtentOf(...args)
  if (extent.kind !== 'extent') {
    throw new Error(`the projection answered ${extent.kind}`)
  }
  return extent
}

describe('frameExtentOf', () => {
  it('projects a point to its exact normalized device coordinates', () => {
    const extent = extentOf([[2, 1, 0]], POSITION, FORWARD, RIGHT_ANGLE, 2)
    expect(extent.x[0]).toBeCloseTo(0.25, 12)
    expect(extent.x[1]).toBeCloseTo(0.25, 12)
    expect(extent.y[0]).toBeCloseTo(0.25, 12)
    expect(extent.y[1]).toBeCloseTo(0.25, 12)
    expect(extent.free).toBeCloseTo(0.75, 12)
    expect(extent.bindingPoint).toBe(0)
  })

  it('takes the free share from the farthest point and names it', () => {
    // (1, 1, 0) reads (0.125, 0.25); (3, 2, 0) reads (0.375, 0.5) and binds.
    const extent = extentOf(
      [
        [1, 1, 0],
        [3, 2, 0],
      ],
      POSITION,
      FORWARD,
      RIGHT_ANGLE,
      2,
    )
    expect(extent.free).toBeCloseTo(0.5, 12)
    expect(extent.bindingPoint).toBe(1)
  })

  it('answers a negative share for a point outside the frame', () => {
    // (0, 8, 0) reads y = 2, a full half frame outside.
    const extent = extentOf([[0, 8, 0]], POSITION, FORWARD, RIGHT_ANGLE, 2)
    expect(extent.free).toBeCloseTo(-1, 12)
  })

  it('names a point behind the camera plane instead of projecting it', () => {
    expect(
      frameExtentOf(
        [
          [0, 0, 0],
          [0, 0, 8],
        ],
        POSITION,
        FORWARD,
        RIGHT_ANGLE,
        2,
      ),
    ).toEqual({
      kind: 'behindCamera',
      point: 1,
    })
  })

  it('names a view straight along world up, which has no roll-free basis', () => {
    expect(frameExtentOf([[0, 0, 0]], [0, 4, 0], [0, -1, 0], RIGHT_ANGLE, 2)).toEqual({
      kind: 'noRollFreeBasis',
    })
  })
})

describe('homeFitVerdictsOf', () => {
  it('holds a pose whose free share reaches the margin exactly, and no less', () => {
    const pose = { label: 'assembled', points: [[0, 3, 0]] as const }
    const free = extentOf(pose.points, POSITION, FORWARD, RIGHT_ANGLE, 2).free
    const verdictAt = (margin: number) =>
      homeFitVerdictsOf([pose], POSITION, FORWARD, RIGHT_ANGLE, 2, margin)[0]
    expect(verdictAt(free)).toMatchObject({ kind: 'verdict', free, holds: true })
    expect(verdictAt(free + Number.EPSILON)).toMatchObject({ kind: 'verdict', holds: false })
  })

  it('names a pose it cannot project instead of measuring it', () => {
    const [outcome] = homeFitVerdictsOf(
      [{ label: 'exploded', points: [[0, 0, 8]] }],
      POSITION,
      FORWARD,
      RIGHT_ANGLE,
      2,
      0.06,
    )
    expect(outcome).toEqual({
      kind: 'unprojectable',
      pose: 'exploded',
      extent: { kind: 'behindCamera', point: 0 },
    })
  })
})

describe('decimalsApart', () => {
  it('answers the fewest decimals, from four, at which a share and the margin print apart', () => {
    expect(decimalsApart(0.05, 0.06)).toBe(4)
    expect(decimalsApart(0.059922, 0.06)).toBe(4)
    expect(decimalsApart(0.059996, 0.06)).toBe(6)
    expect(decimalsApart(0.0599999, 0.06)).toBe(7)
  })
})
