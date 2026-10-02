import { expect, test } from './fixtures'
import { expectPoll, harnessPath, harnessProducts } from './productSpecs'
import type { Product } from '../../src/lib/product'

// The harness look parameter is validated by the manifest schema's own look
// block: a parameter that does not parse shows the harness alert naming the
// problem, on every matrix project. The production page never reads the
// parameter, so this contract lives and fails on the harness page alone.
const products = await harnessProducts()

function firstProduct(): Product {
  const first = products[0]
  if (first === undefined) {
    throw new Error('the look parameter specs need a shipped product')
  }
  return first
}

const first = firstProduct()

function lookPath(backendPath: string, rawLook: string): string {
  return `${harnessPath(backendPath, first.slug)}&look=${encodeURIComponent(rawLook)}`
}

test('a look parameter that is not JSON shows the harness alert', async ({ page, backendPath }) => {
  await page.goto(lookPath(backendPath, 'bright'))
  const alert = page.getByTestId('harness-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('the look parameter is not JSON')
})

test('a look parameter with an unknown key names the key', async ({ page, backendPath }) => {
  await page.goto(lookPath(backendPath, '{"brightness":2}'))
  const alert = page.getByTestId('harness-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('brightness')
})

test('a look parameter with an out-of-range field names the field', async ({
  page,
  backendPath,
}) => {
  await page.goto(lookPath(backendPath, '{"exposure":9}'))
  const alert = page.getByTestId('harness-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('exposure')
})

test('a valid look parameter shows no alert and the product presents', async ({
  page,
  backendPath,
}) => {
  await page.goto(lookPath(backendPath, '{"exposure":2}'))
  await expect(page.getByTestId('harness-alert')).toHaveCount(0)
  await expectPoll(page, () => window.__viewer?.product).toBe('ready')
})
