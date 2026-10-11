import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { siteCopy } from '../../src/lib/copy/site'
import { requireCamera } from './hotspotViews'
import { selectMarkersAtCurrentView } from './markerSelection'
import { clickCompleted, completedPresentation, revealCompleted } from './presentationCompletion'

// A switch keeps the first selection while the visitor zooms out to expose
// another marker. The real zoom limit bounds this drive, with every step
// checked for progress. A source with no reachable target supplies no pair.
export async function switchMarkerView(
  page: Page,
  product: Product,
  target: (shown: ReadonlySet<string>) => boolean,
) {
  await revealCompleted(page, page.locator('canvas'))
  const zoomOut = page.getByRole('button', { name: siteCopy.zoomOutLabel })
  let read = await selectMarkersAtCurrentView(page, product)
  let steps = 0
  while (!target(read.shown) && (await zoomOut.getAttribute('aria-disabled')) !== 'true') {
    const before = await requireCamera(page)
    await clickCompleted(page, zoomOut)
    await completedPresentation(page)
    const after = await requireCamera(page)
    if (after.distance <= before.distance)
      throw new Error('the switch marker drive must advance its zoom-out step')
    steps += 1
    read = await selectMarkersAtCurrentView(page, product)
  }
  return { ...read, steps }
}
