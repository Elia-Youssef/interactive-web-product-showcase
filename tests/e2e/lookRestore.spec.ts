import { lookDefaults } from '../../src/viewer/look/config'
import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { expectPoll, harnessProducts } from './productSpecs'
import { lookHarnessPath } from './lookHarness'
import type { Product } from '../../src/lib/product'

// The look's leave contract, driven over the harness remount button on every
// matrix project: the look probe never outlives the product's look
// component, so nothing answers for a product that left, and a remount
// applies the look again. The page runs StrictMode, so every mount runs the
// application twice with its cleanup in between: the applied opacity being
// exactly the authored scale, rather than the scale of the scale, is the
// proof that the cleanup restores what the setup changed.
const products = await harnessProducts()

function firstProduct(): Product {
  const first = products[0]
  if (first === undefined) {
    throw new Error('the look restore spec needs a shipped product')
  }
  return first
}

const first = firstProduct()

const look = {
  exposure: 2,
  environmentIntensity: 0.5,
  environmentRotationDeg: 90,
  shadowOpacity: 0.5,
}

test('the look leaves with the product and reapplies on remount', async ({ page, backendPath }) => {
  // The first load and the remount's fresh load: the budget module's
  // derivation for that count.
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.goto(lookHarnessPath(backendPath, first.slug, look))
  await expectPoll(page, () => window.__viewer?.product).toBe('ready')
  await expectPoll(page, () => {
    const current = window.__viewer?.look ?? null
    if (current === null) {
      return null
    }
    return {
      exposure: current.exposure,
      environmentIntensity: current.environmentIntensity,
      environmentRotationDeg: current.environmentRotationDeg,
      shadowOpacity: current.shadow?.opacity ?? null,
    }
  }).toEqual({
    exposure: look.exposure,
    environmentIntensity: look.environmentIntensity,
    environmentRotationDeg: look.environmentRotationDeg,
    shadowOpacity: look.shadowOpacity,
  })

  const toggle = page.getByTestId('remount-product')

  // Unmount: the probe goes with the product's look component, so the
  // getter answers null - no stale look answers for a product that left,
  // and the values it would have read are the ones the cleanup restored.
  await toggle.click()
  await expectPoll(page, () => window.__viewer?.product).toBe('idle')
  await expectPoll(page, () => window.__viewer?.look ?? null).toEqual(null)

  // Remount: the look applies again, exact, on a fresh load of the product.
  // An application that compounded its own output would read a scaled
  // scale here, because StrictMode runs the application twice per mount.
  await toggle.click()
  await expectPoll(page, () => window.__viewer?.product).toBe('ready')
  await expectPoll(page, () => window.__viewer?.look?.exposure ?? null).toBe(look.exposure)
  await expectPoll(page, () => window.__viewer?.look?.shadow?.opacity ?? null).toBe(
    look.shadowOpacity,
  )

  // And the restored stage values are what the remount starts from: the
  // look's environment intensity lands exactly as authored, not on top of
  // whatever the leave left behind.
  await expectPoll(page, () => window.__viewer?.look?.environmentIntensity ?? null).toBe(
    look.environmentIntensity,
  )
  await expectPoll(page, () => window.__viewer?.look?.environmentRotationDeg ?? null).toBe(
    look.environmentRotationDeg,
  )
})

test('the look defaults stay the restore target', async () => {
  // The restore writes the config defaults; this pins them so a drifted
  // default cannot silently change what a leaving product hands back.
  expect(lookDefaults).toEqual({
    exposure: 1,
    environmentIntensity: 1,
    environmentRotationDeg: 0,
    shadowOpacity: 1,
  })
})
