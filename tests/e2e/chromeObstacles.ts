import type { Page } from '@playwright/test'
import { readChromeObstacles } from '../../src/lib/hotspots/chromeGeometry'

// Evaluate the runtime's import-free geometry reader on the current DOM.
export async function chromeObstaclesOf(page: Page) {
  const root = await page
    .locator('[data-corner]')
    .first()
    .evaluateHandle((element) => element.parentElement)
  try {
    return await page.evaluate(readChromeObstacles, root)
  } finally {
    await root.dispose()
  }
}
