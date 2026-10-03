import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import {
  expectProductAlert,
  frameFaultPath,
  paintedStagePixels,
  pollProductChannel,
  productChannel,
  remountProduct,
} from './productFailureChannel'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import {
  frameFaultMessage,
  harnessScopedFaultPlaces,
} from '../../src/app/product-harness/frameFaultQuery.ts'

// A frame that throws is owned by the stage's frame path, never by the
// engine's frame loop: under a presented product it fails the product with
// the render kind, never leaving it loading, and under no product it fails
// the stage. The harness's frame fault rides the page's first product mount
// only, so the toggle's remount is new, clean content. The page-error gate
// stays on for every case.

const products = await harnessProducts()

for (const product of products) {
  for (const place of harnessScopedFaultPlaces) {
    test(`a ${place} fault under the presented ${product.slug} fails it with the render kind, and the next product paints the canvas like a clean mount`, async ({
      page,
      backendPath,
    }) => {
      // Two product loads: the clean mount the pixels are measured against,
      // then the remount after the fault.
      test.setTimeout(testBudgetMs({ productLoads: 2 }))

      await page.goto(harnessPath(backendPath, product.slug))
      await waitForProductReady(page)
      const clean = await paintedStagePixels(page)

      await page.goto(frameFaultPath(backendPath, product.slug, place, 'product'))
      await pollProductChannel(page).toEqual({
        product: 'failed',
        productSlug: product.slug,
        failure: { kind: 'render', message: frameFaultMessage(place) },
        status: 'ready',
      })
      await expectProductAlert(page, product.slug, 'A presented frame failed')

      // The next product is new content: it reports ready, and the canvas
      // shows it exactly as a clean mount does. A renderer left broken by
      // the fault would still report ready and record frames, while every
      // frame it drew stayed off the canvas, so the proof is the pixels.
      await remountProduct(page)
      await waitForProductReady(page)
      expect(await paintedStagePixels(page)).toBe(clean)
    })

    test(`a ${place} fault before ${product.slug} presents fails the stage, mounts no content and shows the renderer alert`, async ({
      page,
      backendPath,
    }) => {
      // The fault sits in the stage's own content, beside the product, and
      // throws in the stage's first frames, before the product presents: the
      // stage owns it, so the stage fails.
      await page.goto(frameFaultPath(backendPath, product.slug, place, 'stage'))

      const failedStage = {
        status: 'failed',
        product: 'idle',
        productSlug: null,
        failure: null,
      }
      await pollProductChannel(page).toEqual(failedStage)
      const alert = page.getByTestId('renderer-alert')
      await expect(alert).toBeVisible()
      await expect(alert).toContainText(frameFaultMessage(place))

      // A failed stage mounts no content: a product mounted after the
      // failure never starts a life that could only stay loading.
      await remountProduct(page)
      expect(await productChannel(page)).toEqual(failedStage)
      await expect(alert).toBeVisible()
    })
  }

  test(`a stage camera fault while ${product.slug} is presented fails the stage, never the product`, async ({
    page,
    backendPath,
  }) => {
    // The camera's frame step is the stage's code: the fault arms once the
    // product is presented, and the throw must reach the stage's owner,
    // never the presented product's.
    await page.goto(frameFaultPath(backendPath, product.slug, 'camera', 'stage'))

    await pollProductChannel(page).toEqual({
      status: 'failed',
      product: 'idle',
      productSlug: null,
      failure: null,
    })
    const alert = page.getByTestId('renderer-alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(frameFaultMessage('camera'))
    await expect(page.getByTestId('product-alert')).toHaveCount(0)
  })
}
