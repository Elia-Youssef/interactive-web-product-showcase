import { expect, test } from './fixtures'
import {
  expectProductAlert,
  pollProductChannel,
  productChannel,
  remountProduct,
} from './productFailureChannel'
import { harnessPath, harnessProducts } from './productSpecs'
import {
  frameFaultMessage,
  harnessFrameFaultPlaces,
} from '../../src/app/product-harness/frameFaultQuery.ts'

// A frame that throws is owned by the stage's frame path, never by the
// engine's frame loop: under a presented product it fails the product with
// the render kind, never leaving it loading, and under no product it fails
// the stage. The harness's frame fault rides the page's first product mount
// only, so the toggle's remount is new, clean content. The page-error gate
// stays on for every case.

const products = await harnessProducts()

function faultPath(backendPath: string, slug: string, place: string, scope: string): string {
  return `${harnessPath(backendPath, slug)}&frameFault=${place}&frameFaultScope=${scope}`
}

for (const product of products) {
  for (const place of harnessFrameFaultPlaces) {
    test(`a ${place} fault under the presented ${product.slug} fails it with the render kind, never leaving it loading`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(faultPath(backendPath, product.slug, place, 'product'))
      await pollProductChannel(page).toEqual({
        product: 'failed',
        productSlug: product.slug,
        failure: { kind: 'render', message: frameFaultMessage(place) },
        status: 'ready',
      })
      await expectProductAlert(page, product.slug, 'A presented frame failed')
    })

    test(`a ${place} fault under no presented product fails the stage, mounts no content and shows the renderer alert`, async ({
      page,
      backendPath,
    }) => {
      // The fault sits in the stage's own content, beside the product, and
      // throws in the stage's first frames, before the product presents: the
      // stage owns it, so the stage fails.
      await page.goto(faultPath(backendPath, product.slug, place, 'stage'))

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
}
