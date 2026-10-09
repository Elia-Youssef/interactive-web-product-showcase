import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductCounter } from '../../src/lib/product'
import { expectProduct, openIndexAtRest, productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { productLoadBudgetMs } from './productSpecs'
import { viewportContracts } from './layoutContracts'
import { expectSettledStageScreenshot } from './stageCapture'

// Every shipped route gets the same viewport coverage. The product's
// recorded model must be present before a viewport capture, so a ready
// stage showing another product cannot become that route's baseline.
const collection = await loadCollection()

for (const spec of viewportContracts) {
  for (const product of collection.products) {
    test(`${product.slug} layout visual baseline at ${spec.width}x${spec.height}`, async ({
      page,
      backendPath,
      hostsVisualBaselines,
    }) => {
      test.skip(
        !hostsVisualBaselines,
        'visual baselines are committed for the visual baseline host only',
      )

      await page.setViewportSize({ width: spec.width, height: spec.height })
      await page.goto(productPathOf(backendPath, product))
      await expectProduct(page, product)
      await expect
        .poll(() => page.evaluate(() => window.__viewer?.model?.slug ?? null), {
          timeout: productLoadBudgetMs,
        })
        .toBe(product.slug)
      await expect(page.getByRole('button', { name: siteCopy.openIndexLabel })).toHaveText(
        formatProductCounter(product.number, collection.products.length),
      )

      // Only a viewport capture carries the presented WebGPU canvas. The
      // shared entry settles the frame, HUD and one-time DOM animations.
      await expectSettledStageScreenshot(
        page,
        spec.snapshotName.replace('.png', `-${product.slug}.png`),
      )
    })
  }

  test(`collection index visual baseline at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
    hostsVisualBaselines,
  }) => {
    test.skip(
      !hostsVisualBaselines,
      'visual baselines are committed for the visual baseline host only',
    )

    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(productPathOf(backendPath, collection.first))
    await expectProduct(page, collection.first)
    // The index opens over the page at rest: the open never scrolls the
    // panel to its counter first, and the scroll offsets are pinned across
    // it, so the shot is the page every viewport lands on.
    const dialog = await openIndexAtRest(page)
    await expect(dialog.getByRole('link')).toHaveCount(collection.products.length)
    await expectSettledStageScreenshot(page, `collection-index-${spec.width}x${spec.height}.png`)
  })
}
