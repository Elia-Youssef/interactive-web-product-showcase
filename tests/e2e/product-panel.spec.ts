import { expect, test } from './fixtures'

// The panel evidence runs on the dev-only harness page, which mounts the
// collection loader, the store provider and the panel on their own. No
// canvas is involved, so every matrix project runs it.

const HARNESS_URL = '/panel-harness.html'
const INVALID_HARNESS_URL = '/panel-harness.html?manifests=invalid'

test('the panel shows the stand-in manifest words', async ({ page }) => {
  await page.goto(HARNESS_URL)

  await expect(page.getByText('Wireless over-ear headphones / 001')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Forma\s+One/ })).toBeVisible()
  await expect(page.getByText('A quieter world. A fuller sound.')).toBeVisible()
  await expect(
    page.getByText('Precision-tuned audio in a sculpted, all-day silhouette.'),
  ).toBeVisible()
  await expect(
    page.getByText('Turn it around, discover the details, and make it yours.'),
  ).toBeVisible()
})

test('the finish list shows the heading, one swatch per finish and the default label', async ({
  page,
}) => {
  await page.goto(HARNESS_URL)

  await expect(page.getByText('Choose your finish')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Midnight' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Beach' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Street' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('[data-active-finish]')).toHaveText('Midnight')
})

test('clicking a swatch moves the selected state and the active label', async ({ page }) => {
  await page.goto(HARNESS_URL)

  const beach = page.getByRole('button', { name: 'Beach' })
  const midnight = page.getByRole('button', { name: 'Midnight' })

  await beach.click()

  await expect(beach).toHaveAttribute('aria-pressed', 'true')
  await expect(midnight).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-active-finish]')).toHaveText('Beach')
})

test('the top bar shows the product index label', async ({ page }) => {
  await page.goto(HARNESS_URL)

  await expect(page.getByText('01 / Audio')).toBeVisible()
})

test('a broken manifest list renders the alert error screen with the field paths', async ({
  page,
}) => {
  await page.goto(INVALID_HARNESS_URL)

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('broken-one')
  await expect(alert).toContainText('finishes[0].swatch')
  await expect(alert).toContainText('expected a hex color in #RRGGBB form')
  await expect(alert).toContainText('taglines')
  await expect(alert).toContainText('unknown key')
})
