import { describe, expect, it } from 'vitest'
import { dragStartBounds, freePointerPoints, type PointerRect } from './canvasDrivePoint.logic'

const bounds = { left: 10, top: 20, right: 400, bottom: 540 }
const preferred = { x: 68.5, y: 462 }

describe('an exposed canvas pointer point', () => {
  it('retains a preferred point when no obstacle covers it', () => {
    expect(freePointerPoints(bounds, [], preferred)[0]).toEqual(preferred)
  })

  it.each([
    { left: 50, top: 440, right: 384, bottom: 524 },
    { left: 10, top: 20, right: 400, bottom: 280 },
    { left: 30, top: 80, right: 390, bottom: 520 },
  ])('excludes every candidate covered by an obstacle: $left,$top,$right,$bottom', (obstacle) => {
    const points = freePointerPoints(bounds, [obstacle], preferred)
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      expect(
        point.x < obstacle.left ||
          point.x > obstacle.right ||
          point.y < obstacle.top ||
          point.y > obstacle.bottom,
      ).toBe(true)
    }
  })

  it('uses the actual visible canvas band when the preferred point is clipped', () => {
    const visible = { ...bounds, bottom: 350 }
    const points = freePointerPoints(visible, [], preferred)
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) expect(point.y).toBeLessThan(visible.bottom)
  })

  it('answers no exposed point when several obstacles cover the entire canvas', () => {
    const obstacles: PointerRect[] = [
      { ...bounds, right: 205 },
      { ...bounds, left: 205 },
    ]
    expect(freePointerPoints(bounds, obstacles, preferred)).toEqual([])
  })
})

describe('an exposed start for a complete native drag', () => {
  const canvas = { left: 240, top: 0, right: 1200, bottom: 720 }
  const viewport = { left: 0, top: 0, right: 1440, bottom: 900 }
  const start = { x: 384, y: 612 }

  it.each([
    { x: -600, y: 0, expected: { left: 600, top: 0, right: 1200, bottom: 720 } },
    { x: 600, y: 0, expected: { left: 240, top: 0, right: 840, bottom: 720 } },
    { x: 0, y: -500, expected: { left: 240, top: 500, right: 1200, bottom: 720 } },
    { x: 0, y: 500, expected: { left: 240, top: 0, right: 1200, bottom: 400 } },
    { x: -600, y: -500, expected: { left: 600, top: 500, right: 1200, bottom: 720 } },
    { x: -600, y: 500, expected: { left: 600, top: 0, right: 1200, bottom: 400 } },
    { x: 600, y: -500, expected: { left: 240, top: 500, right: 840, bottom: 720 } },
    { x: 600, y: 500, expected: { left: 240, top: 0, right: 840, bottom: 400 } },
  ])('keeps both ends on the page for displacement $x,$y', ({ x, y, expected }) => {
    const region = dragStartBounds(canvas, viewport, { x, y })
    expect(region).toEqual(expected)
    const points = freePointerPoints(region, [], start)
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      expect(point.x).toBeGreaterThan(canvas.left)
      expect(point.x).toBeLessThan(canvas.right)
      expect(point.y).toBeGreaterThan(canvas.top)
      expect(point.y).toBeLessThan(canvas.bottom)
      expect(point.x + x).toBeGreaterThan(viewport.left)
      expect(point.x + x).toBeLessThan(viewport.right)
      expect(point.y + y).toBeGreaterThan(viewport.top)
      expect(point.y + y).toBeLessThan(viewport.bottom)
    }
  })

  it('retains the clipped canvas for a stationary press', () => {
    expect(dragStartBounds(canvas, viewport, { x: 0, y: 0 })).toEqual(canvas)
  })

  it('keeps the start and end in view when the canvas itself crosses the viewport', () => {
    const oversized = { left: -100, top: -200, right: 1600, bottom: 1100 }
    expect(dragStartBounds(oversized, viewport, { x: 600, y: -500 })).toEqual({
      left: 0,
      top: 500,
      right: 840,
      bottom: 900,
    })
  })

  it('requires a feasible exposed start without shortening the requested drag', () => {
    const region = dragStartBounds(canvas, viewport, { x: 1600, y: 0 })
    expect(freePointerPoints(region, [], start)).toEqual([])
  })
})
