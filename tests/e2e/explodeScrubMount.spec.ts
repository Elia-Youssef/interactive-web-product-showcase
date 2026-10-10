import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { expectPoll, harnessPath, productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { expectFocusOn, expectUnavailable } from './stageKeys'
import { focusVisibly } from './measurementFocus'
import { product, readoutOf, sliderOf, toggleLabel } from './explodeScrubSection'
import { formatExplodePercent } from '../../src/lib/copy/productPanel'

// The exploded view's scrub section under the mount lifecycle, on the dev
// harness: the readouts a remount returns to, and the focus a detach leaves
// where it found it. The section's own behavior on the app's panel is the
// spec beside this one.

test('remounting from open returns the slider and the readout to 0%', async ({
  page,
  backendPath,
}) => {
  await page.goto(harnessPath(backendPath, product.slug))
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)

  const slider = sliderOf(page)
  await expect(slider).toBeEnabled()
  await slider.fill('0.5')
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0.5)
  await expect(readoutOf(page)).toHaveText(formatExplodePercent(0.5))

  const remount = page.getByTestId('remount-product')

  // Unmount from the open state: the readout reaction's release publishes
  // idle, so nothing stale survives the view, and the control waits like
  // the toggle while no view is attached.
  await remount.click()
  await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
  await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
  await expectUnavailable(slider)
  await expect(slider).toHaveValue('0')
  await expect(readoutOf(page)).toHaveText(formatExplodePercent(0))

  // Remount: presented assembled again, the control live at the rest.
  await remount.click()
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  await expect(slider).toBeEnabled()
  await expect(slider).toHaveValue('0')
  await expect(readoutOf(page)).toHaveText(formatExplodePercent(0))
})

test('the section stays focused while the view detaches under it, and answers again', async ({
  page,
  backendPath,
}) => {
  await page.goto(harnessPath(backendPath, product.slug))
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)

  const toggle = page.getByRole('button', { name: toggleLabel })
  await focusVisibly(page, toggle)
  await expectFocusOn(toggle, 'the toggle holds the keyboard focus before the detach')

  // The view detaches while the toggle holds the focus. The harness mount
  // control is driven programmatically, the one click that moves no focus,
  // so the detach lands on a focused control the way an engine that keeps
  // the focus on press lands it.
  await toggleProductMount(page)

  await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
  await expectUnavailable(toggle)
  await expectFocusOn(toggle, 'the detach leaves the focus on the waiting toggle')

  // The view attaches again: the toggle answers from the focus the detach
  // left on it.
  await toggleProductMount(page)
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
  await expect(toggle).not.toHaveAttribute('aria-disabled')
  await expectFocusOn(toggle, 'the attach leaves the focus where the detach found it')
  await page.keyboard.press('Enter')
  await expectFocusOn(toggle, 'the toggle keeps the focus it opens the view from')
  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(1)
})

// The harness mount control, clicked programmatically: a trusted click
// would move the focus in the engines that focus a button on press, and the
// point of the drive is the state change under a focus that stays.
async function toggleProductMount(page: Page): Promise<void> {
  await page.evaluate(() => {
    const remount = document.querySelector<HTMLElement>('[data-testid="remount-product"]')
    if (remount === null) {
      throw new Error('the harness mount control is missing')
    }
    remount.click()
  })
}
