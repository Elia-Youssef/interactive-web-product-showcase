import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductIndex } from '../../src/lib/product'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'

// The panel evidence runs on the app itself, over the real manifests. The
// expected words are the collection's own, so a manifest that ships shows
// here without a change below. The error screen runs on the dev-only
// invalid-collection page, which is the same app over a deliberately broken
// manifest list.
const INVALID_COLLECTION_URL = '/invalid-collection.html'

const product = (await loadCollection()).first

test("the panel shows the collection's first product manifest words", async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)

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
  backendPath,
}) => {
  await page.goto(backendPath)

  // The schema guarantees at least one finish; the default is the first.
  const active = product.finishes[0]
  if (active === undefined) {
    throw new Error("the collection's first product offers no finishes")
  }

  await expect(page.getByText(siteCopy.finishHeading)).toBeVisible()
  // The finish heading is the section's heading: a visitor navigating by
  // headings lands here, at the level the page outline gives it.
  await expect(page.getByRole('heading', { level: 2, name: siteCopy.finishHeading })).toBeVisible()
  const group = page.getByRole('radiogroup', { name: siteCopy.finishHeading })
  await expect(group).toBeVisible()
  for (const finish of product.finishes) {
    await expect(page.getByRole('radio', { name: finish.label })).toHaveAttribute(
      'aria-checked',
      finish.variant === active.variant ? 'true' : 'false',
    )
  }
  await expect(page.locator('[data-active-finish]')).toHaveText(active.label)
})

test('clicking a swatch moves the selected state and the active label', async ({
  page,
  backendPath,
}) => {
  test.skip(product.finishes.length < 2, 'a product with one finish has nothing to switch to')

  await page.goto(backendPath)

  const from = product.finishes[0]
  const to = product.finishes[1]
  if (from === undefined || to === undefined) {
    throw new Error('a second finish must exist for the swatch switch')
  }

  const target = page.getByRole('radio', { name: to.label })
  const previous = page.getByRole('radio', { name: from.label })

  await target.click()

  await expect(target).toHaveAttribute('aria-checked', 'true')
  await expect(previous).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('[data-active-finish]')).toHaveText(to.label)
})

test('the arrow keys move the choice with the focus across the swatches, wrapping at the ends', async ({
  page,
  expectedBackend,
  backendPath,
}) => {
  test.skip(product.finishes.length < 2, 'a product with one finish has nothing to step to')

  await page.goto(backendPath)
  await waitForProductReady(page)
  expect(await page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)

  const radios = product.finishes.map((finish) => page.getByRole('radio', { name: finish.label }))
  const first = radios[0]
  if (first === undefined) {
    throw Error('the schema guarantees at least one finish')
  }

  // The checked radio is the group one tab stop: Tab lands there, an arrow
  // moves the choice with the focus, and the walk wraps at the ends, so a
  // step past the last comes back to the first.
  await first.focus()
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute('aria-checked', 'true')

  for (let step = 1; step < product.finishes.length; step++) {
    await page.keyboard.press('ArrowRight')
    const current = radios[step]
    if (current === undefined) {
      throw new Error('the walk left the finish list')
    }
    await expect(current).toBeFocused()
    await expect(current).toHaveAttribute('aria-checked', 'true')
    await expect(first).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('[data-active-finish]')).toHaveText(
      product.finishes[step]?.label ?? '',
    )
  }

  await page.keyboard.press('ArrowRight')
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute('aria-checked', 'true')

  // Back again, the same rule the other way.
  await page.keyboard.press('ArrowLeft')
  const last = radios[radios.length - 1]
  if (last === undefined) {
    throw new Error('the finish list holds no last finish')
  }
  await expect(last).toBeFocused()
  await expect(last).toHaveAttribute('aria-checked', 'true')
})

test('the top bar shows the product index label', async ({ page, backendPath }) => {
  await page.goto(backendPath)

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
