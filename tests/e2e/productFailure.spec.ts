import { expect, test } from './fixtures'
import { brokenFinishModel } from './brokenFinishModel'
import { unknownMappingVariantMessage } from '../../src/lib/product'
import { productFailureCopy, productFailureDisplay } from '../../src/viewer/product/failureMessage'
import { expectProductAlert, pollProductChannel, remountProduct } from './productFailureChannel'
import { harnessPath, sampledHarnessProducts, waitForProductReady } from './productSpecs'

// Every anticipated product failure reaches the one product channel as a
// typed value: the product ends failed with the failure's kind and facts,
// the renderer stays ready, and the stage's alert names the product. The
// suite's page-error gate stays on for every case, so a failure the channel
// handled that also escaped as a page error fails the test.

const products = await sampledHarnessProducts()

for (const product of products) {
  const modelUrl = `/models/${product.slug}/model.glb`

  test(`a model of ${product.slug} that cannot load fails the product with the load kind and no page error`, async ({
    page,
    backendPath,
    expectedBrowserName,
    consoleGate,
  }) => {
    // Take the model away for this page only: every request for it fails, so
    // the product channel must carry the failure while the stage renderer
    // stays ready. The browser's own line for the failed request exists only
    // in the Chromium builds, so it is declared there alone; the product's
    // failure itself is never a console or page error.
    await page.route(`**${modelUrl}`, (route) => route.abort())
    if (expectedBrowserName === 'chromium') {
      consoleGate.expectError(/Failed to load resource|net::/, { times: 'one-or-more' })
    }

    await page.goto(harnessPath(backendPath, product.slug))

    await pollProductChannel(page).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: { kind: 'load', url: modelUrl, message: expect.any(String) },
      status: 'ready',
    })
    await expectProductAlert(
      page,
      product.slug,
      productFailureDisplay({ kind: 'load', url: modelUrl, message: '' }).reason,
    )
  })

  test(`a failed load of ${product.slug} is loaded anew by the next mount`, async ({
    page,
    backendPath,
    expectedBrowserName,
    consoleGate,
  }) => {
    // Only the first request for the model fails: the failed load must be
    // forgotten with the failed mount, so the next mount loads the model
    // again instead of reading the failed outcome back from the stage's
    // loads.
    let requests = 0
    await page.route(`**${modelUrl}`, (route) => {
      requests += 1
      return requests === 1 ? route.abort() : route.continue()
    })
    if (expectedBrowserName === 'chromium') {
      consoleGate.expectError(/Failed to load resource|net::/, { times: 1 })
    }

    await page.goto(harnessPath(backendPath, product.slug))
    await pollProductChannel(page).toMatchObject({ product: 'failed', failure: { kind: 'load' } })
    await remountProduct(page)

    await waitForProductReady(page)
    expect(requests).toBe(2)
  })

  test(`a camera block of ${product.slug} the home view cannot meet fails the product with the camera contract kind and no page error`, async ({
    page,
    backendPath,
  }) => {
    // A minimum distance far past any home view: the camera rules break on
    // the shipped model, with no model of its own needed. The block itself
    // is valid, so the manifest schema lets it through to the runtime rules.
    const camera = JSON.stringify({ minDistance: 1000 })
    await page.goto(
      `${harnessPath(backendPath, product.slug)}&camera=${encodeURIComponent(camera)}`,
    )

    await pollProductChannel(page).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: {
        kind: 'camera-contract',
        problems: expect.arrayContaining([
          expect.objectContaining({ rule: 'view-within-distance-limits' }),
        ]),
      },
      status: 'ready',
    })
    await expectProductAlert(page, product.slug, productFailureCopy.cameraContract)
  })

  test(`a model of ${product.slug} whose finish mapping is broken fails the product with the finish contract kind and no page error`, async ({
    page,
    backendPath,
  }) => {
    // The shipped bytes with one mapping pointed past the declared variants:
    // the file loads and parses, and only the finish plan read objects, so
    // the failure must name the mapping problem, never pass as a load error.
    const broken = await brokenFinishModel(product.slug)
    await page.route(`**${modelUrl}`, (route) =>
      route.fulfill({ body: broken.bytes, contentType: 'model/gltf-binary' }),
    )

    await page.goto(harnessPath(backendPath, product.slug))

    await pollProductChannel(page).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: {
        kind: 'finish-contract',
        problems: [
          expect.objectContaining({
            message: unknownMappingVariantMessage(0, broken.namedVariant, broken.declaredVariants),
          }),
        ],
      },
      status: 'ready',
    })
    await expectProductAlert(page, product.slug, productFailureCopy.finishContract)
  })
}
