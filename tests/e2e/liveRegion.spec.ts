import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { neighborsOf, productPathOf, rowControls, expectProduct } from './collectionFacts'
import { createCollection, productName } from '../../src/lib/product'
import type { Page } from '@playwright/test'

// The shell's one live region, on the app itself: a finish selection and a
// product switch are the two changes the page itself does not speak, and
// each is announced by its own words. The expected words are the
// collection's own, so a product that ships is under test without a change
// below.

const collection = await loadCollection()
const first = collection.first

// Distinct products may legally share display words.
// Keep their render data intact and replace only copy at the manifest boundary.
const sharedWords = createCollection(
  collection.products.map((product) => ({
    ...product,
    brand: 'Sample',
    model: 'Shared',
  })),
)

async function presentSharedWords(page: Page): Promise<void> {
  await page.route(/\/src\/products\/[^/]+\.manifest\.ts(?:\?.*)?$/, async (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').at(-1)
    const product = sharedWords.bySlug(filename?.replace('.manifest.ts', '') ?? '')
    if (product === undefined) {
      throw new Error(`the collection holds no manifest '${filename}'`)
    }
    await route.fulfill({
      contentType: 'application/javascript',
      body: `export const manifest = ${JSON.stringify(product)};`,
    })
  })
}

test('a finish selection is announced by the shell live region', async ({
  page,
  expectedBackend,
  backendPath,
}) => {
  test.skip(first.finishes.length < 2, 'a product with one finish has nothing to switch to')

  await page.goto(backendPath)
  await waitForProductReady(page)
  expect(await page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)

  const to = first.finishes[1]
  if (to === undefined) {
    throw new Error('a second finish must exist for the announced switch')
  }
  const region = page.locator('[data-live-announcement]')
  await expect(region).toHaveText('')

  await page.getByRole('radio', { name: to.label }).click()

  await expect(region).toHaveText(to.label)
})

test('a product switch is announced by the shell live region', async ({ page, backendPath }) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  const viaNext = neighborsOf(collection, first).next

  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)

  const region = page.locator('[data-live-announcement]')
  await expect(region).toHaveText('')

  const { next } = rowControls(page, collection, first)
  await next.click()
  await expectProduct(page, viaNext)

  await expect(region).toHaveText(productName(viaNext))
})

test('successive products with identical names refresh the live message', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  test.skip(sharedWords.products.length < 3, 'three products exercise successive shared names')
  await presentSharedWords(page)
  await page.goto(productPathOf(backendPath, sharedWords.first))
  await waitForProductReady(page)

  const second = neighborsOf(sharedWords, sharedWords.first).next
  await rowControls(page, sharedWords, sharedWords.first).next.click()
  await expectProduct(page, second)
  const region = page.locator('[data-live-announcement]')
  await expect(region).toHaveText(productName(second))
  const previousMessage = await region.evaluateHandle((element) => element.firstChild)

  const third = neighborsOf(sharedWords, second).next
  await rowControls(page, sharedWords, second).next.click()
  await expectProduct(page, third)
  await expect(region).toHaveText(productName(third))
  await expect
    .poll(
      () =>
        region.evaluate((element, previous) => element.firstChild === previous, previousMessage),
      { timeout: productLoadBudgetMs },
    )
    .toBe(false)
  await previousMessage.dispose()
})
