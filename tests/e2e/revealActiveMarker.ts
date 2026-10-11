import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { markerOf, mountedMarkerOf, requireCamera } from './hotspotViews'
import { clickCompleted, completedPresentation, revealCompleted } from './presentationCompletion'

// Zoom out through the visitor control until the selected marker can be
// pressed. Every step must advance the camera; its real limit ends the
// drive with a named geometric constraint rather than a skipped close way.
export async function revealActiveMarker(page: Page, title: string): Promise<void> {
  await revealCompleted(page, page.locator('canvas'))
  const zoomOut = page.getByRole('button', { name: siteCopy.zoomOutLabel })
  while (!(await mountedMarkerOf(page, title).isVisible())) {
    if ((await zoomOut.getAttribute('aria-disabled')) === 'true') {
      throw new Error(
        `the active marker ${title} cannot be re-exposed by zooming out at ${JSON.stringify(page.viewportSize())}`,
      )
    }
    const before = await requireCamera(page)
    await clickCompleted(page, zoomOut)
    await completedPresentation(page)
    const after = await requireCamera(page)
    if (after.distance <= before.distance)
      throw new Error(
        `the active marker reveal must advance its zoom-out drive: ${JSON.stringify({ before, after })}`,
      )
  }
  await markerOf(page, title).click({ trial: true })
}
