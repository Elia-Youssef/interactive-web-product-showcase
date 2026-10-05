import { expect } from '@playwright/test'
import { test } from './fixtures'
import { hudDrainBudgetMs, testBudgetMs } from './budgets'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductCounter, formatProductIndex, productName } from '../../src/lib/product'
import { formatProductPath } from '../../src/lib/routing'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import { routePath } from './appPaths'
import {
  dialogTabStops,
  expectProduct,
  expectTabHeldInsideDialog,
  focusedAccessibleName,
  neighborsOf,
  openShownCard,
  plainTabReachesLinks,
  productPathOf,
  productWithHotspots,
  rowControls,
  urlPath,
  walkToDialogStop,
} from './collectionFacts'

// The collection navigation proofs run on the app itself, over the real
// collection: the counter, the neighbors and the index all read the same
// validated list the app reads, so a product that ships is under test
// without a change below. The per-product rows prove the data; the walk
// from the first product proves the moves, the history and the query.

const collection = await loadCollection()
const products = collection.products
const first = collection.first
const NOT_FOUND_PATH = '/p/does-not-exist'

for (const product of products) {
  test(`the navigation row of ${product.slug} reads the counter and the collection's neighbors`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(productPathOf(backendPath, product))
    await waitForProductReady(page)

    const { counter, previous, next, neighbors } = rowControls(page, collection, product)
    await expect(counter).toHaveText(formatProductCounter(product.number, products.length))
    await expect(previous).toHaveAttribute(
      'href',
      routePath(backendPath, formatProductPath(neighbors.previous.slug)),
    )
    await expect(next).toHaveAttribute(
      'href',
      routePath(backendPath, formatProductPath(neighbors.next.slug)),
    )
  })
}

test('clicking next, then previous, moves between products, and back and forward walk the same ones', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 5 }))
  const start = first
  const viaNext = neighborsOf(collection, start).next
  const backAgain = neighborsOf(collection, viaNext).previous

  await page.goto(productPathOf(backendPath, start))
  await waitForProductReady(page)

  // Next moves to the collection's next product, and the URL the click
  // lands on is the address the link shows.
  const { next } = rowControls(page, collection, start)
  const nextHref = await next.getAttribute('href')
  await next.click()
  await expectProduct(page, viaNext)
  expect(urlPath(page.url())).toBe(nextHref)

  // Previous from there returns along the collection's own neighbor.
  const { previous } = rowControls(page, collection, viaNext)
  const previousHref = await previous.getAttribute('href')
  await previous.click()
  await expectProduct(page, backAgain)
  expect(urlPath(page.url())).toBe(previousHref)

  // The history walks the same products back and forward, query included.
  await page.goBack()
  await expectProduct(page, viaNext)
  expect(urlPath(page.url())).toBe(nextHref)

  await page.goForward()
  await expectProduct(page, backAgain)
  expect(urlPath(page.url())).toBe(previousHref)
})

test('the index opens from the counter, lists every product in order and marks the open one', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)

  const { counter } = rowControls(page, collection, first)
  await counter.click()
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
  await expect(dialog).toBeVisible()

  // Every product, in collection order: the row addresses are the
  // collection's own paths in its order, and one row per product.
  const rows = dialog.getByRole('link')
  await expect(rows).toHaveCount(products.length)
  const hrefs: (string | null)[] = []
  for (let index = 0; index < products.length; index++) {
    hrefs.push(await rows.nth(index).getAttribute('href'))
  }
  expect(hrefs).toEqual(
    products.map((product) => routePath(backendPath, formatProductPath(product.slug))),
  )
  const dialogText = await dialog.textContent()
  for (const product of products) {
    expect(dialogText).toContain(formatProductIndex(product.number))
    expect(dialogText).toContain(productName(product))
    expect(dialogText).toContain(product.category)
  }

  // The open product's row carries the current page marker, alone.
  const currentRow = dialog.getByRole('link', { name: productName(first) })
  await expect(currentRow).toHaveAttribute('aria-current', 'page')
  expect(await dialog.locator('[aria-current="page"]').count()).toBe(1)

  // Choosing another product navigates there and closes the index.
  const other = neighborsOf(collection, first).next
  await dialog.getByRole('link', { name: productName(other) }).click()
  await expectProduct(page, other)
  expect(urlPath(page.url())).toBe(productPathOf(backendPath, other))
  await expect(dialog).toBeHidden()
})

test('escape and the close button close the index, and focus returns to the counter', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)

  const { counter } = rowControls(page, collection, first)
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })

  await counter.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(counter).toBeFocused()

  await counter.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: siteCopy.closeIndexLabel }).click()
  await expect(dialog).toBeHidden()
  await expect(counter).toBeFocused()
})

test('escape over the open index closes the index alone: an open hotspot card stays open', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  const subject = productWithHotspots(collection)

  await page.goto(productPathOf(backendPath, subject))
  await waitForProductReady(page)

  const cardTitle = await openShownCard(page, subject)
  const card = page.getByRole('heading', { name: cardTitle })
  await expect(card).toBeVisible()

  await page.getByRole('button', { name: siteCopy.openIndexLabel }).click()
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(card, 'the card never saw the index its escape').toBeVisible()
})

test('escape at every stop of the open index closes the index alone, and the next escape closes the card', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  const subject = productWithHotspots(collection)

  await page.goto(productPathOf(backendPath, subject))
  await waitForProductReady(page)

  const cardTitle = await openShownCard(page, subject)
  const card = page.getByRole('heading', { name: cardTitle })
  const marker = page.getByRole('button', { name: cardTitle })
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })

  // The stops of the cycle, enumerated once with the card and the index
  // open. The platform rests one stop of the cycle on the body, where no
  // handler scoped to the dialog ever sees the key.
  await page.getByRole('button', { name: siteCopy.openIndexLabel }).click()
  await expect(dialog).toBeVisible()
  const stops = await dialogTabStops(page)

  // One fresh open per stop: at that stop, and only there, Escape closes
  // the index, returns to the counter and leaves the card open; the card
  // takes the next Escape.
  for (const stop of stops) {
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)

    await marker.click()
    await expect(card).toBeVisible()
    await page.getByRole('button', { name: siteCopy.openIndexLabel }).click()
    await expect(dialog).toBeVisible()
    await walkToDialogStop(page, stop)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('button', { name: siteCopy.openIndexLabel }),
      'focus returns to the counter from every stop',
    ).toBeFocused()
    await expect(card, 'the card survives the index escape at every stop').toBeVisible()

    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
  }
})

test('keyboard only: the tab walks the row, enter opens the index, escape closes it back onto the counter', async ({
  page,
  backendPath,
  expectedBrowserName,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)

  const { counter, previous, next } = rowControls(page, collection, first)
  const activeName = () => focusedAccessibleName(page)

  // The panel's own controls precede the row, so the walk tabs until the
  // row. How far a plain tab reaches is the engine's keyboard model over
  // links, named once in the facts and pinned by the link tabbing spec:
  // on chromium and firefox the walk proves the row's own order, previous
  // link, counter, next link; on webkit it proves the counter as the
  // row's stop and leaves the links to the platform's full keyboard
  // access mode.
  const previousName = await previous.getAttribute('aria-label')
  if (previousName === null) {
    throw new Error('the previous link carries no accessible name')
  }
  const linksTabbable = plainTabReachesLinks(expectedBrowserName)
  const rowTarget = linksTabbable ? previousName : siteCopy.openIndexLabel
  for (let tabs = 0; ; tabs++) {
    if (tabs > 30) {
      throw new Error('the tab order never reached the row')
    }
    await page.keyboard.press('Tab')
    if ((await activeName()) === rowTarget) {
      break
    }
  }
  if (linksTabbable) {
    await page.keyboard.press('Tab')
    expect(await activeName()).toBe(siteCopy.openIndexLabel)
    await page.keyboard.press('Tab')
    expect(await activeName()).toBe(await next.getAttribute('aria-label'))

    // Back onto the counter by keyboard.
    await page.keyboard.press('Shift+Tab')
    expect(await activeName()).toBe(siteCopy.openIndexLabel)
  }

  // Enter on the counter opens the index.
  await counter.press('Enter')
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
  await expect(dialog).toBeVisible()

  // The open dialog holds the tab: no stop ever lands on the page's
  // content, the platform's own containment.
  await expectTabHeldInsideDialog(page)

  // Escape closes the open index back onto the counter, all by keyboard.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(counter).toBeFocused()
})

test('the counter lifts its whole readout on hover', async ({ page, backendPath }) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)

  const { counter } = rowControls(page, collection, first)
  const readout = counter.locator('span')
  const before = await readout.evaluate((element) => getComputedStyle(element).color)

  await counter.hover()
  // The lift is one hover transition of the control; the allowance is the
  // suite's named small-wait budget.
  await expect
    .poll(() => readout.evaluate((element) => getComputedStyle(element).color), {
      timeout: hudDrainBudgetMs,
    })
    .toBe('rgb(255, 255, 255)')
  expect(before).not.toBe('rgb(255, 255, 255)')
})

test('the not-found page renders no navigation row', async ({ page, backendPath }) => {
  await page.goto(routePath(backendPath, NOT_FOUND_PATH))

  await expect(page.getByRole('heading', { name: siteCopy.notFoundHeading })).toBeVisible()
  await expect(page.getByRole('button', { name: siteCopy.openIndexLabel })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Previous:/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0)
})
