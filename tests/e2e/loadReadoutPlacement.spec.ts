import { productModelUrl } from '../../src/lib/product'
import { stageConfig } from '../../src/viewer/config'
import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { harnessPath, productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { testBudgetMs } from './budgets'
import { holdDownloads } from './heldDownloads'
import { viewportContracts } from './layoutContracts'
import { chromeOverlaps, figureOf } from './loadReadoutFacts'

// The readout's placement while a load is held: clear of the stage chrome
// at every layout viewport, and absent from the pages that compose none.

const first = (await loadCollection()).first
const heldPaths = [stageConfig.environmentFile, productModelUrl(first.slug)]

// The readout's figure right now, or null while it shows none, as a poll
// body that never mistakes no figure for a low one.
async function figureOrBelow(page: Parameters<typeof figureOf>[0]): Promise<number> {
  return (await figureOf(page)) ?? -1
}

test('the held readout keeps clear of the stage chrome at every layout viewport', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  const held = await holdDownloads(page, heldPaths)
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)
  await held.release(2)
  await expect.poll(() => figureOrBelow(page), { timeout: productLoadBudgetMs }).toBeGreaterThan(0)

  for (const viewport of viewportContracts) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    expect(await chromeOverlaps(page), `${viewport.width}x${viewport.height}`).toEqual([])
  }

  await held.releaseAll()
  await waitForProductReady(page)
})

test('the harness page mounts no readout', async ({ page, backendPath }) => {
  await page.goto(harnessPath(backendPath, first.slug))
  await waitForProductReady(page)

  expect(await page.locator('[data-load-readout]').count()).toBe(0)
})
