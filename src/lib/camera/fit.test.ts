import { describe, expect, it } from 'vitest'
import { fitDistance } from './fit'

// Geometry of the fit: a camera at distance d with vertical half view angle
// h sees, at the sphere's depth, a half window of d * tan(h) vertically and
// d * tan(h) * aspect horizontally. The sphere of radius r fits exactly when
// the perpendicular distance from the camera to the nearer frustum wall
// equals r, and that distance is d * sin(half view angle of that wall).

const radius = 2

// Clearance between the camera and one frustum wall: the perpendicular
// distance from the camera to the plane through the wall's tangent line.
function clearanceAt(distance: number, halfFovY: number, aspect: number): number {
  const halfFovX = Math.atan(Math.tan(halfFovY) * aspect)
  return Math.min(distance * Math.sin(halfFovY), distance * Math.sin(halfFovX))
}

describe('fitDistance', () => {
  it('fits a sphere through the height when the aspect is wide', () => {
    const fovY = (75 * Math.PI) / 180
    const distance = fitDistance({ radius, fovY, aspect: 16 / 9 })
    // The vertical wall binds: it touches the sphere exactly, while the
    // horizontal wall keeps a strict margin.
    expect(distance * Math.sin(fovY / 2)).toBeCloseTo(radius, 12)
    const halfFovX = Math.atan(Math.tan(fovY / 2) * (16 / 9))
    expect(distance * Math.sin(halfFovX)).toBeGreaterThan(radius)
  })

  it('fits a sphere through the width when the aspect is tall', () => {
    const fovY = (75 * Math.PI) / 180
    const aspect = 9 / 16
    const distance = fitDistance({ radius, fovY, aspect })
    const halfFovX = Math.atan(Math.tan(fovY / 2) * aspect)
    expect(distance * Math.sin(halfFovX)).toBeCloseTo(radius, 12)
    expect(distance * Math.sin(fovY / 2)).toBeGreaterThan(radius)
  })

  it('clears the sphere at every wall and touches one, at any aspect', () => {
    const fovY = (60 * Math.PI) / 180
    for (const aspect of [0.3, 0.75, 1, 1.4, 2.4, 3.2]) {
      const distance = fitDistance({ radius, fovY, aspect })
      const clearance = clearanceAt(distance, fovY / 2, aspect)
      expect(clearance).toBeCloseTo(radius, 12)
    }
  })

  it('is exact, with no rounding of the trigonometric result', () => {
    // A vertical half view of 30 degrees gives radius / sin(30 degrees) as
    // the exact expression; the function may differ from it only by the
    // float error of computing the sine, never by a rounding step.
    const fovY = (60 * Math.PI) / 180
    const distance = fitDistance({ radius, fovY, aspect: 2 })
    expect(distance).toBeCloseTo(radius / Math.sin(Math.PI / 6), 15)
  })

  it('grows once the width binds, and as the field of view widens', () => {
    const fovY = (75 * Math.PI) / 180
    const wide = fitDistance({ radius, fovY, aspect: 2 })
    const square = fitDistance({ radius, fovY, aspect: 1 })
    const tall = fitDistance({ radius, fovY, aspect: 0.5 })
    // At aspect 1 and above the height binds, so the distance holds steady
    // and only grows when the width becomes the narrower wall.
    expect(wide).toBeCloseTo(square, 12)
    expect(square).toBeLessThan(tall)

    const narrow = fitDistance({ radius, fovY: (100 * Math.PI) / 180, aspect: 1 })
    expect(narrow).toBeLessThan(square)
  })

  it('scales linearly with the radius', () => {
    const fovY = (75 * Math.PI) / 180
    const unit = fitDistance({ radius: 1, fovY, aspect: 1.5 })
    expect(fitDistance({ radius: 7.5, fovY, aspect: 1.5 })).toBeCloseTo(unit * 7.5, 12)
  })
})
