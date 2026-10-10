import type { Page } from '@playwright/test'
import { chromeObstaclesOf } from './chromeObstacles'
import { dragStartBounds, freePointerPoints, type PointerRect } from './canvasDrivePoint.logic'

// Start a drive on exposed canvas, using the current shared chrome boxes
// and the actual mounted overlay bounds. Confirm the native hit target too.
export async function canvasDrivePoint(
  page: Page,
  options?: {
    readonly preferred: { readonly x: number; readonly y: number }
    readonly travel: { readonly x: number; readonly y: number }
  },
): Promise<{ x: number; y: number }> {
  const chrome =
    (await page.locator('[data-corner]').count()) === 0 ? [] : await chromeObstaclesOf(page)
  const geometry = await page.locator('canvas').evaluate(canvasPointerGeometry, chrome)
  const bounds = dragStartBounds(
    geometry.bounds,
    geometry.viewport,
    options?.travel ?? { x: 0, y: 0 },
  )
  const points = freePointerPoints(
    bounds,
    geometry.blocks,
    options?.preferred ?? geometry.preferred,
  )
  return page.locator('canvas').evaluate((canvas, candidates) => {
    for (const point of candidates) {
      if (document.elementFromPoint(point.x, point.y) === canvas) return point
    }
    throw new Error('the visible stage exposes no canvas pointer target')
  }, points)
}

// This read runs inside the page and keeps all DOM geometry in one snapshot.
function canvasPointerGeometry(canvas: Element, obstacles: readonly PointerRect[]) {
  const box = canvas.getBoundingClientRect()
  const bounds = {
    left: Math.max(0, box.left),
    top: Math.max(0, box.top),
    right: Math.min(innerWidth, box.right),
    bottom: Math.min(innerHeight, box.bottom),
  }
  const blocks = obstacles.map((obstacle) => ({
    left: obstacle.left + box.left,
    top: obstacle.top + box.top,
    right: obstacle.right + box.left,
    bottom: obstacle.bottom + box.top,
  }))
  for (const element of document.querySelectorAll(
    '[data-stage-overlay] button, [data-testid="hotspot-card"]',
  )) {
    const css = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    if (css.visibility !== 'visible' || rect.width === 0 || rect.height === 0) continue
    blocks.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
  }
  return {
    bounds,
    viewport: { left: 0, top: 0, right: innerWidth, bottom: innerHeight },
    blocks,
    preferred: { x: box.left + box.width * 0.15, y: box.top + box.height * 0.85 },
  }
}
