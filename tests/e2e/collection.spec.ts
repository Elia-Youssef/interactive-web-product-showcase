import { expect } from '@playwright/test'
import { test } from './fixtures'
import { testBudgetMs } from './budgets'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductCounter, formatProductIndex, productName } from '../../src/lib/product'
import { formatProductPath } from '../../src/lib/routing'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import { routePath } from './appPaths'
import { expectProduct, neighborsOf, productPathOf, rowControls, urlPath } from './collectionFacts'

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
  const subject = products.find((product) => product.hotspots.length > 0)
  if (subject === undefined) {
    throw new Error('the collection holds no product with hotspots to prove the escape boundary')
  }
  const hotspot = subject.hotspots[0]
  if (hotspot === undefined) {
    throw new Error('the subject product holds no hotspot')
  }

  await page.goto(productPathOf(backendPath, subject))
  await waitForProductReady(page)

  // The first shown marker opens its card; a marker the view hides leaves
  // the role tree, so the role query finds a shown one only.
  let openedCard: string | undefined
  for (const candidate of subject.hotspots) {
    const marker = page.getByRole('button', { name: candidate.title })
    if (await marker.isVisible()) {
      await marker.click()
      openedCard = candidate.title
      break
    }
  }
  if (openedCard === undefined) {
    throw new Error(`no marker of '${subject.slug}' is shown at the home view`)
  }
  const card = page.getByRole('heading', { name: openedCard })
  await expect(card).toBeVisible()

  await page.getByRole('button', { name: siteCopy.openIndexLabel }).click()
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(card, 'the card never saw the index its escape').toBeVisible()
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
  const activeName = () =>
    page.evaluate(() => {
      const element = document.activeElement
      if (element === null) {
        return null
      }
      return element.getAttribute('aria-label') ?? element.textContent ?? element.tagName
    })

  // The panel's own controls precede the row, so the walk tabs until the
  // row. What a plain Tab reaches is the platform's own keyboard model:
  // chromium and firefox tab to links, so there the walk proves the row's
  // own order, previous link, counter, next link. The webkit build follows
  // the macOS model and skips links entirely (its walk lands slider, then
  // counter), so there the walk proves the counter as the row's stop and
  // leaves the links to the platform's full keyboard access mode.
  const previousName = await previous.getAttribute('aria-label')
  if (previousName === null) {
    throw new Error('the previous link carries no accessible name')
  }
  const linksTabbable = expectedBrowserName !== 'webkit'
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
  // content. The platform wraps the cycle itself, and its wrap rests one
  // stop on the body between cycles before re-entering at the top; the
  // dialog is the platform's own containment, with no hand-written trap.
  for (let tabs = 0; tabs < 8; tabs++) {
    await page.keyboard.press('Tab')
    const stoppedAt = await page.evaluate(() => {
      const element = document.activeElement
      if (element === null) {
        return 'null'
      }
      return element.closest('dialog') !== null || element === document.body
        ? 'held'
        : `${element.tagName} ${element.getAttribute('aria-label') ?? ''}`
    })
    expect(stoppedAt, 'the tab must never land outside the open dialog').toBe('held')
  }

  // Escape closes the open index back onto the counter, all by keyboard.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(counter).toBeFocused()
})

test('the not-found page renders no navigation row', async ({ page, backendPath }) => {
  await page.goto(routePath(backendPath, NOT_FOUND_PATH))

  await expect(page.getByRole('heading', { name: siteCopy.notFoundHeading })).toBeVisible()
  await expect(page.getByRole('button', { name: siteCopy.openIndexLabel })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Previous:/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0)
})
