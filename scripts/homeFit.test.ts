// The home-fit math, table-driven: the projection a point takes through a
// roll-free camera at the authored aspect, the free share a frame keeps,
// the nearest a pose's box corner comes to the camera plane, and the
// allowance share a storage error spends. Every expected value is computed
// by hand from the definitions, so the rule reads tested math.
import { describe, expect, it } from 'vitest'
import { allowanceShareOf, frameExtentOf, nearestCornerDepthOf, round5 } from './homeFit.ts'

// A camera at (0, 0, 4) looking down -Z with a 90 degree vertical fov: the
// tan of the half fov is 1, so a point's normalized coordinates are
// x = qx / (z * aspect) and y = qy / z, all divided by the depth 4.
const FORWARD: [number, number, number] = [0, 0, -1]
const POSITION: [number, number, number] = [0, 0, 4]
const RIGHT_ANGLE = Math.PI / 2

describe('frameExtentOf', () => {
  it('projects a point to its exact normalized device coordinates', () => {
    const extent = frameExtentOf([[2, 1, 0]], POSITION, FORWARD, RIGHT_ANGLE, 2)
    expect(extent.x[0]).toBeCloseTo(0.25, 12)
    expect(extent.x[1]).toBeCloseTo(0.25, 12)
    expect(extent.y[0]).toBeCloseTo(0.25, 12)
    expect(extent.y[1]).toBeCloseTo(0.25, 12)
    expect(extent.free).toBeCloseTo(0.75, 12)
    expect(extent.bindingPoint).toBe(0)
  })

  it('takes the free share from the farthest point and names it', () => {
    // (1, 1, 0) reads (0.125, 0.25); (3, 2, 0) reads (0.375, 0.5) and binds.
    const extent = frameExtentOf(
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
    const extent = frameExtentOf([[0, 8, 0]], POSITION, FORWARD, RIGHT_ANGLE, 2)
    expect(extent.free).toBeCloseTo(-1, 12)
  })

  it('refuses a point behind the camera plane', () => {
    expect(() => frameExtentOf([[0, 0, 8]], POSITION, FORWARD, RIGHT_ANGLE, 2)).toThrow(
      /behind the camera plane/,
    )
  })
})

describe('nearestCornerDepthOf', () => {
  it('reads the nearest of the eight box corners along the view', () => {
    // The box [0, 2] x [0, 2] x [0, 0.5]: its nearest corner to a camera on
    // the +Z axis is the one at z = 0.5, 3.5 in front of the eye.
    const depth = nearestCornerDepthOf(
      [
        [0, 0, 0.5],
        [2, 2, 0],
      ],
      POSITION,
      FORWARD,
    )
    expect(depth).toBeCloseTo(3.5, 12)
  })

  it('answers the depth of the points themselves when they share one plane', () => {
    const depth = nearestCornerDepthOf([[1, 1, 0]], POSITION, FORWARD)
    expect(depth).toBeCloseTo(4, 12)
  })
})

describe('allowanceShareOf', () => {
  it('scales the world error into a share of the half frame through z and the half fov', () => {
    // d / (z * sin(fov/2)): at depth 4 under a 90 degree fov the half
    // angle is 45 degrees, so an error of 4 * sin(45 degrees) reads as a
    // full half frame.
    expect(allowanceShareOf(2, 4, RIGHT_ANGLE)).toBeCloseTo(1 / Math.SQRT2, 12)
    expect(allowanceShareOf(0.002, 4, RIGHT_ANGLE)).toBeCloseTo(0.002 / (4 * Math.SQRT1_2), 12)
  })

  it('refuses a nearest corner behind the camera', () => {
    expect(() => allowanceShareOf(1, 0, RIGHT_ANGLE)).toThrow(/behind the camera plane/)
  })
})

describe('round5', () => {
  it('reads a share at five decimals', () => {
    expect(round5(0.059921)).toBe(0.05992)
    expect(round5(0.059999999)).toBe(0.06)
  })
})
