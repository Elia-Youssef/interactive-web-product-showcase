import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import { testBudgetMs } from './budgets'
import { neighborsOf, productPathOf, rowControls, expectProduct } from './collectionFacts'
import { productName } from '../../src/lib/product'

// The shell's one live region, on the app itself: a finish selection and a
// product switch are the two changes the page itself does not speak, and
// each is announced by its own words. The expected words are the
// collection's own, so a product that ships is under test without a change
// below.

const collection = await loadCollection()
const first = collection.first

test('a finish selection is announced by the shell live region', async ({ page }) => {
  test.skip(first.finishes.length < 2, 'a product with one finish has nothing to switch to')

  await page.goto('/')

  const to = first.finishes[1]
  if (to === undefined) {
    throw new Error('a second finish must exist for the announced switch')
  }
  const region = page.locator('[data-live-announcement]')
  await expect(region).toHaveText('')

  await page.getByRole('button', { name: to.label }).click()

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
