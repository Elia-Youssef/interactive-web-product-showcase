import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { chromeCollisionsOf } from './hotspotChromeChecks'
import { shownMarkerIdsOf, requireCamera } from './hotspotViews'
import { markerViewsOf, markersShownIn } from './productMarkerViews'
import { readProductCameraFacts, type AuthoredView } from './productCamera'
import { readProductHotspotFacts } from './productHotspots'
import { readMarkerExtentTokens } from './markerExtentTokens'

// One eligibility boundary at a settled product, layout and view. Node
// supplies projection, stage fit and occlusion candidates; the page supplies
// the CSS chrome. Card placement and readability never enter eligibility.
export async function selectMarkersAtView(
  page: Page,
  product: Product,
  nodeShown: ReadonlySet<string>,
  view: string,
): Promise<{ shown: ReadonlySet<string>; chromeHidden: readonly string[] }> {
  const shown = await shownMarkerIdsOf(page, product)
  const chromeHidden = await chromeCollisionsOf(page, product)
  const viewport = page.viewportSize()
  const layout = viewport === null ? 'unknown' : `${viewport.width}x${viewport.height}`
  for (const id of nodeShown) {
    if (!shown.has(id) && !chromeHidden.includes(id)) {
      throw new Error(
        `at ${layout}, ${id} of ${product.slug} is neither shown nor chrome hidden at ${view}`,
      )
    }
  }
  for (const id of shown) {
    if (!nodeShown.has(id)) {
      throw new Error(
        `at ${layout}, ${id} of ${product.slug} shows outside the Node candidates at ${view}`,
      )
    }
  }
  return { shown, chromeHidden }
}

// The home convenience uses the measured canvas, never a viewport guessed
// to have the same stage geometry as the product page.
export async function selectMarkersAtHome(page: Page, product: Product) {
  const box = await page.locator('canvas').boundingBox()
  if (box === null) throw new Error('marker selection requires a presented canvas')
  const [facts, views, extent] = await Promise.all([
    readProductHotspotFacts(product.slug, product),
    readProductCameraFacts(product.slug),
    readMarkerExtentTokens(),
  ])
  return selectMarkersAtView(
    page,
    product,
    markerViewsOf(facts, views, { box, extent }).home,
    'home',
  )
}

// Visitor camera actions change the source view. Node still proves its
// geometry and occlusion, using the measured camera with no extra contain.
export async function selectMarkersAtCurrentView(page: Page, product: Product) {
  const box = await page.locator('canvas').boundingBox()
  if (box === null) throw new Error('marker selection requires a presented canvas')
  const [facts, camera, extent] = await Promise.all([
    readProductHotspotFacts(product.slug, product),
    requireCamera(page),
    readMarkerExtentTokens(),
  ])
  const view: Pick<AuthoredView, 'position' | 'target' | 'fovY' | 'aspect'> = {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [camera.target.x, camera.target.y, camera.target.z],
    aspect: box.width / box.height,
    fovY: camera.fovY,
  }
  return selectMarkersAtView(
    page,
    product,
    markersShownIn(facts, view, { box, extent }),
    'visitor camera view',
  )
}
