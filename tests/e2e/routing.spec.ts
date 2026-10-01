import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { siteCopy } from '../../src/lib/copy/site'
import {
  formatProductPath,
  notFoundDocumentTitle,
  productDocumentTitle,
} from '../../src/lib/routing'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'

// The routing proofs remount the product on every history move: two loads
// in the heaviest test body, so the budget follows the loads.
test.setTimeout(testBudgetMs({ productLoads: 2 }))

// The collection's own order is the expectation, so a product that ships
// lands here without a change below. The collection holds one product
// today, so the history flow runs between the product and the not-found
// screen; a second product extends it to a two-product flow.
const collection = await loadCollection()
const first = collection.first
const NOT_FOUND_PATH = '/p/does-not-exist'

// The app path for this project's backend mode: the mode's query rides
// along on the deep link, exactly as the app's own navigate carries it.
function routePath(backendPath: string, path: string): string {
  return path + new URL(backendPath, 'https://app.invalid').search
}

test('a deep link to a product slug presents it and the title names it', async ({
  page,
  backendPath,
}) => {
  await page.goto(routePath(backendPath, formatProductPath(first.slug)))

  await waitForProductReady(page)
  await expect.poll(() => page.evaluate(() => window.__viewer?.productSlug)).toBe(first.slug)
  await expect(page).toHaveTitle(productDocumentTitle(first, siteCopy.collectionName))
})

test('the root replaces itself with the first product path and presents it', async ({
  page,
  backendPath,
}) => {
  const modeSearch = new URL(backendPath, 'https://app.invalid').search

  await page.goto(backendPath)
  await waitForProductReady(page)
  await expect
    .poll(() => page.evaluate(() => location.pathname))
    .toBe(formatProductPath(first.slug))
  // The backend query is state every view needs, so the replace carried it.
  await expect(page).toHaveURL(`${formatProductPath(first.slug)}${modeSearch}`)
  const lengthAfterFirstVisit = await page.evaluate(() => window.history.length)

  // The same visit again: the second goto adds exactly its own entry, so
  // the count may only grow by one. A push in the app's own write would
  // grow it by two.
  await page.goto(backendPath)
  await waitForProductReady(page)
  await expect
    .poll(() => page.evaluate(() => location.pathname))
    .toBe(formatProductPath(first.slug))
  expect(await page.evaluate(() => window.history.length)).toBe(lengthAfterFirstVisit + 1)
})

test('an unknown slug shows the not-found screen with no renderer, and its link presents the first product', async ({
  page,
  backendPath,
}) => {
  await page.goto(routePath(backendPath, NOT_FOUND_PATH))

  await expect(page.getByRole('heading', { name: siteCopy.notFoundHeading })).toBeVisible()
  await expect(page.getByText(siteCopy.notFoundLine)).toBeVisible()
  await expect(page).toHaveTitle(
    notFoundDocumentTitle(siteCopy.notFoundHeading, siteCopy.collectionName),
  )

  // No renderer started: the automation hook is installed by the stage for
  // its lifetime, so the hook's absence is the contract's own word for a
  // page with no stage.
  expect(await page.evaluate(() => window.__viewer)).toBeUndefined()
  await expect(page.locator('canvas')).toHaveCount(0)

  await page.getByRole('link', { name: siteCopy.notFoundLink }).click()
  await waitForProductReady(page)
  await expect.poll(() => page.evaluate(() => window.__viewer?.productSlug)).toBe(first.slug)
  await expect
    .poll(() => page.evaluate(() => location.pathname))
    .toBe(formatProductPath(first.slug))
  await expect(page).toHaveTitle(productDocumentTitle(first, siteCopy.collectionName))
})

test('back and forward between the product and the not-found screen re-render each', async ({
  page,
  backendPath,
}) => {
  await page.goto(routePath(backendPath, NOT_FOUND_PATH))
  await page.getByRole('link', { name: siteCopy.notFoundLink }).click()
  await waitForProductReady(page)

  await page.goBack()
  await expect(page.getByRole('heading', { name: siteCopy.notFoundHeading })).toBeVisible()
  await expect(page).toHaveTitle(
    notFoundDocumentTitle(siteCopy.notFoundHeading, siteCopy.collectionName),
  )
  await expect(page.locator('canvas')).toHaveCount(0)

  await page.goForward()
  await waitForProductReady(page)
  await expect.poll(() => page.evaluate(() => window.__viewer?.productSlug)).toBe(first.slug)
  await expect(page).toHaveTitle(productDocumentTitle(first, siteCopy.collectionName))
})
