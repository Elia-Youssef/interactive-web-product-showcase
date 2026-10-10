import { expect, test } from './fixtures'
import {
  expectPoll,
  harnessPath,
  harnessProducts,
  productLoadBudgetMs,
  waitForProductReady,
} from './productSpecs'
import { selectHotspotProducts } from './hotspotProducts'
import { settledFrames } from './stageSettle'
import { testBudgetMs } from './budgets'

const products = await harnessProducts()
const hotspotProducts = new Set(selectHotspotProducts(products))

for (const product of products.filter((entry) => !hotspotProducts.has(entry))) {
  test(`hotspotless ${product.slug}: ready and remounted products have no anchors, markers, cards or overlay placements`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 2 }))
    await page.goto(harnessPath(backendPath, product.slug))
    await waitForProductReady(page)
    await expectEmptyHotspots()

    await page.getByTestId('remount-product').click()
    await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
    await page.getByTestId('remount-product').click()
    await waitForProductReady(page)
    await expectEmptyHotspots()

    async function expectEmptyHotspots() {
      await settledFrames(page)
      expect(
        await page.evaluate(() => ({
          anchors: window.__viewer?.hotspots?.hotspots,
          rig: window.__viewer?.rig?.hotspots,
          placements: window.__viewer?.overlay?.placements,
          markers: document.querySelectorAll('[data-stage-overlay] button[aria-pressed]').length,
          cards: document.querySelectorAll('[data-testid="hotspot-card"]').length,
        })),
      ).toEqual({ anchors: [], rig: [], placements: {}, markers: 0, cards: 0 })
    }
  })
}
