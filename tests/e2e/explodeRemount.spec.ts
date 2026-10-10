import { productLoadBudgetMs, testBodyBudgetMs, testBudgetMs } from './budgets'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { readExplodeModelFacts } from './explodeModelFacts'
import { frameFaultPath, pollProductChannel, remountProduct } from './productFailureChannel'
import {
  expectProductRetirementReports,
  observeEnvironmentSettleFailures,
} from './environmentSettleReports'
import { expectPoll, harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { siteCopy } from '../../src/lib/copy/site'
import { frameFaultMessage } from '../../src/app/product-harness/frameFaultQuery.ts'

// The remount contract on the dev harness: the presented view lives and
// dies with the product. The explode toggle next to the remount control
// opens the view, so a real remount can start from the open state and prove
// that the next presentation is assembled, with the toggle's own state as
// the paired lifetime's readout. A product a present fault failed takes its
// view with it, and the next product, on the fresh canvas the stage gives
// new content after a retired renderer, attaches its own view and drives it.
const products = await harnessProducts()

for (const product of products) {
  const facts = await readExplodeModelFacts(product.slug)
  const toggleLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

  test(`remounting the ${product.slug} presents it assembled`, async ({ page, backendPath }) => {
    await page.goto(harnessPath(backendPath, product.slug))

    await waitForProductReady(page)
    await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
    await expectPose(page, facts.firstPose)

    const toggle = page.getByTestId('remount-product')

    // Unmount: the product leaves, its explode feature with it, and the
    // automation reading is gone.
    await toggle.click()
    await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
    await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()

    // Remount: presented assembled again, at the clip's first keyframes.
    await toggle.click()
    await waitForProductReady(page)
    await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(0)
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
    await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
    await expectPose(page, facts.firstPose)
  })

  test(`remounting the open ${product.slug} presents it assembled`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(harnessPath(backendPath, product.slug))

    await waitForProductReady(page)
    const explodeToggle = page.getByRole('button', { name: toggleLabel })
    const remount = page.getByTestId('remount-product')

    // Open: the presented view reaches the far end and its last keyframes.
    await explodeToggle.click()
    await expect(explodeToggle).toHaveAttribute('aria-pressed', 'true')
    await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(1)
    await expectPose(page, facts.lastPose)

    // Unmount from the open state: the reading is gone and the toggle,
    // still rendered with its product's row, is disabled while nothing is
    // attached.
    await remount.click()
    await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
    await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
    await expect(explodeToggle).toBeDisabled()

    // Remount: the toggle is enabled and not pressed, and the presentation
    // is assembled again, at the clip's first keyframes.
    await remount.click()
    await waitForProductReady(page)
    await expect(explodeToggle).toBeEnabled()
    await expect(explodeToggle).toHaveAttribute('aria-pressed', 'false')
    await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(0)
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
    await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
    await expectPose(page, facts.firstPose)
  })

  test(`after a present fault fails the ${product.slug}, the next product on a fresh canvas attaches its exploded view and drives it`, async ({
    page,
    backendPath,
    consoleGate,
  }) => {
    // Two product loads: the faulted first mount, then the remount.
    test.setTimeout(testBudgetMs({ productLoads: 2 }))

    await observeEnvironmentSettleFailures(page)
    await page.goto(frameFaultPath(backendPath, product.slug, 'present', 'product'))
    await pollProductChannel(page).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: { kind: 'render', message: frameFaultMessage('present') },
      status: 'ready',
    })
    const explodeToggle = page.getByRole('button', { name: toggleLabel })

    // The failed product left the stage with its view: nothing is attached,
    // so the toggle is disabled and there is no reading.
    await expect(explodeToggle).toBeDisabled()
    await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
    const retiredCanvas = await page.locator('canvas').elementHandle()
    if (retiredCanvas === null) {
      throw new Error('the stage must still show the canvas the present fault retired')
    }

    // The remount is new, clean content, so the stage mounts it on a fresh
    // canvas: the retired one has left the page.
    await remountProduct(page)
    await waitForProductReady(page)
    expect(await retiredCanvas.evaluate((canvas) => canvas.isConnected)).toBe(false)

    // The new product's view is attached and assembled, and the toggle
    // drives it to the far end and its last keyframes.
    await expect(explodeToggle).toBeEnabled()
    await expect(explodeToggle).toHaveAttribute('aria-pressed', 'false')
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
    await expectPose(page, facts.firstPose)
    await explodeToggle.click()
    await expect(explodeToggle).toHaveAttribute('aria-pressed', 'true')
    await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
    await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(1)
    await expectPose(page, facts.lastPose)
    await expectProductRetirementReports(page, consoleGate)
  })
}

async function expectPose(
  page: Page,
  pose: Readonly<Record<string, readonly [number, number, number]>>,
): Promise<void> {
  for (const [name, expected] of Object.entries(pose)) {
    const [x, y, z] = expected
    // The part name rides as the evaluate argument: a free variable of the
    // callback is not captured into the page, and `name` there is the
    // window's own empty string. Each part is awaited, so the pose is
    // asserted before the test moves on.
    await expect
      .poll(() => page.evaluate((partName) => window.__viewer?.explode?.parts[partName], name), {
        timeout: testBodyBudgetMs,
      })
      .toEqual({ x, y, z })
  }
}
