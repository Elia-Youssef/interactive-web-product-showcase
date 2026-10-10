import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'
import { chromeObstaclesOf } from './chromeObstacles'
import { requireCamera, requireHotspots, mountedMarkerOf } from './hotspotViews'
import { projectToStageBox } from './hotspotPlacement'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { rectsMeet } from '../../src/lib/hotspots/chromeGeometry'
import type { Product } from '../../src/lib/product'

const extent = await readMarkerExtentTokens()

export async function chromeCollisionsOf(page: Page, product: Product): Promise<string[]> {
  const camera = await requireCamera(page)
  const probe = await requireHotspots(page)
  const stage = await page.locator('canvas').boundingBox()
  if (stage === null) throw new Error('a presented stage must have bounds')
  const obstacles = await chromeObstaclesOf(page)
  expect(obstacles.length, 'the page exposes current chrome obstacles').toBeGreaterThan(0)
  const half = extent.markerHitPx / 2 + extent.focusOutsetPx
  const hidden: string[] = []
  for (const hotspot of product.hotspots) {
    const anchor = probe.hotspots.find((entry) => entry.id === hotspot.id)
    if (anchor === undefined) throw new Error('every manifest hotspot must have an anchor')
    const point = projectToStageBox(camera, anchor.position, stage)
    const keepOut = {
      left: point.x - half,
      top: point.y - half,
      right: point.x + half,
      bottom: point.y + half,
    }
    const collisions = obstacles.filter((obstacle) => rectsMeet(keepOut, obstacle))
    const marker = mountedMarkerOf(page, hotspot.title)
    if (collisions.length > 0) {
      hidden.push(hotspot.id)
      await expect(marker, 'the whole hit area and ring hide on any chrome contact').toBeHidden()
    }
  }
  return hidden
}

export async function checkChrome(page: Page, product: Product): Promise<string[]> {
  const hidden = await chromeCollisionsOf(page, product)
  for (const hotspot of product.hotspots) {
    const marker = mountedMarkerOf(page, hotspot.title)
    if (await marker.isVisible()) {
      expect(hidden, 'every shown marker clears every chrome slot').not.toContain(hotspot.id)
      await expectShownMarkerAnswers(marker)
    }
  }
  return hidden
}

async function expectShownMarkerAnswers(marker: Locator): Promise<void> {
  const hit = await marker.evaluate((element) => {
    const box = element.getBoundingClientRect()
    // The circular button owns its center and cardinal extents. Its
    // entire square box plus ring is checked against chrome above.
    return [
      [0.1, 0.5],
      [0.5, 0.1],
      [0.5, 0.5],
      [0.9, 0.5],
      [0.5, 0.9],
    ].every(([x, y]) => {
      if (x === undefined || y === undefined) throw new Error('a hit sample needs both axes')
      const target = document.elementFromPoint(box.left + box.width * x, box.top + box.height * y)
      return target !== null && element.contains(target)
    })
  })
  expect(hit, 'the center and cardinal extents receive their own marker').toBe(true)
  const bounds = await marker.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('the marker is a layout element')
    return { width: element.offsetWidth, height: element.offsetHeight }
  })
  expect(bounds?.width, 'the marker keeps its complete hit width').toBe(extent.markerHitPx)
  expect(bounds?.height, 'the marker keeps its complete hit height').toBe(extent.markerHitPx)
}
