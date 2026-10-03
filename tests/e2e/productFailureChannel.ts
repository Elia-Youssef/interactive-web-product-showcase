import { expect, type Page } from '@playwright/test'
import { productLoadBudgetMs } from './budgets'
import { settledStageCapture } from './stageCapture'
import { backdropCeiling, countRegionPixelsBrighterThan } from './stagePixels'

// The failure channel as the product failure specs read it: the product and
// renderer channels of the automation in one snapshot, the alerts the stage
// shows, the harness's remount, and the painted stage pixels.

export function productChannel(page: Page) {
  return page.evaluate(() => ({
    product: window.__viewer?.product,
    productSlug: window.__viewer?.productSlug,
    failure: window.__viewer?.productFailure,
    status: window.__viewer?.status,
  }))
}

// The failed terminal state rides the same budget as ready: the channel
// cannot report a failure before the stage has started and the product has
// mounted, and that start stretches under the matrix's load.
export function pollProductChannel(page: Page) {
  return expect.poll(() => productChannel(page), { timeout: productLoadBudgetMs })
}

// The product alert is a DOM element outside the Canvas and names the
// product.
export async function expectProductAlert(page: Page, slug: string, text: string): Promise<void> {
  const alert = page.getByTestId('product-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText(slug)
  await expect(alert).toContainText(text)
}

// Unmounts the harness's product and mounts it again: the remount is a new
// product life, on clean content.
export async function remountProduct(page: Page): Promise<void> {
  const toggle = page.getByTestId('remount-product')
  await toggle.click()
  await expect(toggle).toHaveText('Mount the product')
  await toggle.click()
  await expect(toggle).toHaveText('Unmount the product')
}

// The stage pixels brighter than the backdrop can ever be, at rest: the
// settled capture with the dev HUD and the harness controls masked, counted
// inside the canvas box, so only what the renderer painted can answer. A
// renderer that draws offscreen leaves the canvas at the backdrop.
export async function paintedStagePixels(page: Page): Promise<number> {
  const capture = await settledStageCapture(page, ['harnessControls'])
  const box = await page.locator('canvas').boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  return (await countRegionPixelsBrighterThan(page, capture, box, backdropCeiling)).count
}
