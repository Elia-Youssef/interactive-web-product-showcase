import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductIndex } from '../../src/features/product-panel/product-panel.logic'
import { loadCollection } from './productList'

// The panel evidence runs on the app itself, over the real manifests. The
// expected words are the collection's own, so a manifest that ships shows
// here without a change below. The error screen runs on the dev-only
// invalid-collection page, which is the same app over a deliberately broken
// manifest list.
const APP_URL = '/'
const INVALID_COLLECTION_URL = '/invalid-collection.html'

const product = (await loadCollection()).first

test("the panel shows the collection's first product manifest words", async ({ page }) => {
  await page.goto(APP_URL)

  await expect(page.getByText(product.eyebrow)).toBeVisible()
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading.getByText(product.brand)).toBeVisible()
  await expect(heading.getByText(product.model)).toBeVisible()
  await expect(page.getByText(product.tagline)).toBeVisible()
  for (const line of product.intro) {
    await expect(page.getByText(line)).toBeVisible()
  }
})

test('the finish list shows the heading, one swatch per finish and the default label', async ({
  page,
}) => {
  await page.goto(APP_URL)

  // The schema guarantees at least one finish; the default is the first.
  const active = product.finishes[0]
  if (active === undefined) {
    throw new Error("the collection's first product offers no finishes")
  }

  await expect(page.getByText(siteCopy.finishHeading)).toBeVisible()
  for (const finish of product.finishes) {
    await expect(page.getByRole('button', { name: finish.label })).toHaveAttribute(
      'aria-pressed',
      finish.variant === active.variant ? 'true' : 'false',
    )
  }
  await expect(page.locator('[data-active-finish]')).toHaveText(active.label)
})

test('clicking a swatch moves the selected state and the active label', async ({ page }) => {
  test.skip(product.finishes.length < 2, 'a product with one finish has nothing to switch to')

  await page.goto(APP_URL)

  const from = product.finishes[0]
  const to = product.finishes[1]
  if (from === undefined || to === undefined) {
    throw new Error('a second finish must exist for the swatch switch')
  }

  const target = page.getByRole('button', { name: to.label })
  const previous = page.getByRole('button', { name: from.label })

  await target.click()

  await expect(target).toHaveAttribute('aria-pressed', 'true')
  await expect(previous).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-active-finish]')).toHaveText(to.label)
})

test('the top bar shows the product index label', async ({ page }) => {
  await page.goto(APP_URL)

  const label = `${formatProductIndex(product.number)} / ${product.category}`
  await expect(page.getByText(label)).toBeVisible()
})

test('a broken manifest list renders the alert error screen with the field paths', async ({
  page,
}) => {
  await page.goto(INVALID_COLLECTION_URL)

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('broken-one')
  await expect(alert).toContainText('finishes[0].swatch')
  await expect(alert).toContainText('expected a hex color in #RRGGBB form')
  await expect(alert).toContainText('taglines')
  await expect(alert).toContainText('unknown key')
})
