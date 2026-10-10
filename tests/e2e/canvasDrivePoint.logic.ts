type Point = { readonly x: number; readonly y: number }
export type PointerRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// Obstacle edges partition the visible canvas into cells. A cell's middle
// lies in exposed space exactly when none of its obstacle boxes contains it.
export function freePointerPoints(
  bounds: PointerRect,
  obstacles: readonly PointerRect[],
  preferred: Point,
): Point[] {
  const xs = new Set([bounds.left, bounds.right])
  const ys = new Set([bounds.top, bounds.bottom])
  for (const obstacle of obstacles) {
    xs.add(Math.max(bounds.left, Math.min(bounds.right, obstacle.left)))
    xs.add(Math.max(bounds.left, Math.min(bounds.right, obstacle.right)))
    ys.add(Math.max(bounds.top, Math.min(bounds.bottom, obstacle.top)))
    ys.add(Math.max(bounds.top, Math.min(bounds.bottom, obstacle.bottom)))
  }
  const columns = [...xs].sort((a, b) => a - b)
  const rows = [...ys].sort((a, b) => a - b)
  const points = [preferred]
  for (let x = 1; x < columns.length; x += 1) {
    for (let y = 1; y < rows.length; y += 1) {
      const left = columns[x - 1]
      const right = columns[x]
      const top = rows[y - 1]
      const bottom = rows[y]
      if (left === undefined || right === undefined || top === undefined || bottom === undefined)
        throw new Error('every pointer cell requires both edges')
      points.push({ x: (left + right) / 2, y: (top + bottom) / 2 })
    }
  }
  return points
    .filter(
      (point) =>
        point.x > bounds.left &&
        point.x < bounds.right &&
        point.y > bounds.top &&
        point.y < bounds.bottom &&
        obstacles.every(
          (box) =>
            point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom,
        ),
    )
    .sort(
      (a, b) =>
        (a.x - preferred.x) ** 2 +
        (a.y - preferred.y) ** 2 -
        ((b.x - preferred.x) ** 2 + (b.y - preferred.y) ** 2),
    )
}

// Choose an exposed start for the full requested displacement. Both ends
// of a native drag stay in the viewport, where release can reach the page.
export function dragStartBounds(
  canvas: PointerRect,
  viewport: PointerRect,
  travel: Point,
): PointerRect {
  return {
    left: Math.max(canvas.left, viewport.left, viewport.left - travel.x),
    top: Math.max(canvas.top, viewport.top, viewport.top - travel.y),
    right: Math.min(canvas.right, viewport.right, viewport.right - travel.x),
    bottom: Math.min(canvas.bottom, viewport.bottom, viewport.bottom - travel.y),
  }
}
