import { expect, test } from './fixtures'
import { expectPoll, harnessPath, harnessProducts } from './productSpecs'

const products = await harnessProducts()

for (const product of products) {
  test(`a model of ${product.slug} that cannot load fails the product, never the renderer`, async ({
    page,
    backendPath,
    expectedBrowserName,
    consoleGate,
  }) => {
    // Take the model away for this page only: every request for it fails, so
    // the product channel must carry the failure while the stage renderer
    // stays ready. The uncaught load error is declared on every browser; the
    // browser's own line for the failed request exists only in the Chromium
    // builds, so it is declared there alone.
    await page.route(`**/models/${product.slug}/model.glb`, (route) => route.abort())
    if (expectedBrowserName === 'chromium') {
      consoleGate.expectError(/Failed to load resource|net::/, { times: 'one-or-more' })
    }
    consoleGate.expectError(new RegExp(`Could not load .*/models/${product.slug}/model[.]glb`), {
      times: 'one-or-more',
    })

    await page.goto(harnessPath(backendPath, product.slug))

    await expectPoll(page, () => ({
      product: window.__viewer?.product,
      productSlug: window.__viewer?.productSlug,
      failure: window.__viewer?.productFailure,
      status: window.__viewer?.status,
    })).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: expect.stringContaining('Could not load'),
      status: 'ready',
    })

    // The alert is a DOM element outside the Canvas and names the product.
    const alert = page.getByTestId('product-alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(product.slug)
    await expect(alert).toContainText('Could not load')
  })
}
