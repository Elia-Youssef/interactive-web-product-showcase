import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { loadCollection } from './productList'
import { expectPoll, harnessPath, productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { renderedFramesOf, settledFrames } from './stageSettle'
import { expectFocusOn, expectUnavailable } from './stageKeys'
import { focusVisibly } from './measurementFocus'
import { resolvedTokenColor } from './tokenColor'
import { siteCopy } from '../../src/lib/copy/site'
import { explodeScrubName, formatExplodePercent } from '../../src/lib/copy/productPanel'

// The exploded view's scrub control: the slider under the toggle and its
// mono readout, on the app's panel, with the remount proof on the dev
// harness. The slider is driven through the real input, so the native
// contract (fill, value, value text) is the one under test, and every text
// the readout shows is held to the panel's own format function, imported
// here, so the display rule has no second copy in the spec.

const product = (await loadCollection()).first

const toggleLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
const scrubName = explodeScrubName(product)

const readoutOf = (page: Page) => page.locator('[data-explode-readout]')
const sliderOf = (page: Page) => page.getByRole('slider', { name: scrubName })

test('before the product is presented the section waits unavailable and reads 0%', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)

  // The panel renders with the route, before any model presents. Nothing is
  // attached, so the control waits like the toggle does, at the assembled
  // rest: the thumb at 0 and the readout at 0%.
  const slider = sliderOf(page)
  await expectUnavailable(slider)
  await expect(slider).toHaveValue('0')
  await expect(slider).toHaveAttribute('aria-valuetext', '0%')
  await expect(readoutOf(page)).toHaveText('0%')

  // The waiting toggle reads as a waiting control: the one disabled color
  // the waiting controls share, a different word of the palette than the
  // label color a rest button carries, so the disabled state is visible and
  // not color-alone (the cursor with it).
  const toggle = page.getByRole('button', { name: toggleLabel })
  await expectUnavailable(toggle)
  await expect(toggle).toHaveCSS('color', await resolvedTokenColor(page, '--disabled'))
})

test('the waiting section keeps the keyboard focus and ignores activation until the product presents', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  const toggle = page.getByRole('button', { name: toggleLabel })
  const slider = sliderOf(page)

  // The toggle is reached by keyboard while it waits: it keeps the focus,
  // and its activation arms nothing.
  await focusVisibly(page, toggle)
  await expectFocusOn(toggle, 'the waiting toggle takes the keyboard focus')
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__viewer?.explode ?? null)).toBeNull()
  await expectFocusOn(toggle, 'the dropped press leaves the focus on the waiting toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  // The scrub's keys move nothing while it waits.
  await focusVisibly(page, slider)
  await page.keyboard.press('ArrowDown')
  await expect(slider).toHaveValue('0')
  await expect(readoutOf(page)).toHaveText('0%')
  await expectFocusOn(slider, 'the waiting scrub keeps the focus under its keys')

  // The product presents: both controls answer again, the focus never
  // having left the section, and the toggle opens the view from the keys.
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
  await expect(toggle).not.toHaveAttribute('aria-disabled')
  await expect(slider).not.toHaveAttribute('aria-disabled')
  await focusVisibly(page, toggle)
  await page.keyboard.press('Enter')
  await expectFocusOn(toggle, 'the toggle keeps the focus it opens the view from')
  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(1)
})

test('the two controls of the section are named apart', async ({
  page,
  expectedBackend,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForExplodeMounted(page)
  expect(await page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)

  // Each name answers for exactly one control: the toggle's word names no
  // slider, the scrub name names no button. The match is the whole name,
  // not a piece of it, which is what a screen reader reads a control by.
  await expect(page.getByRole('button', { name: toggleLabel })).toBeVisible()
  await expect(page.getByRole('slider', { name: scrubName })).toBeVisible()
  await expect(page.getByRole('slider', { name: toggleLabel, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: scrubName, exact: true })).toHaveCount(0)
})

test('a scrub to the middle opens the view to the target and reads 50%', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForExplodeMounted(page)

  const slider = sliderOf(page)
  await expect(slider).toBeEnabled()
  await slider.fill('0.5')

  // What was asked for is the store's target; the view follows through the
  // spring and at rest lands exactly on it.
  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(0.5)
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0.5)

  // The readout is where the pose is, and the slider's value text says the
  // same thing.
  await expect(readoutOf(page)).toHaveText('50%')
  await expect(slider).toHaveAttribute('aria-valuetext', '50%')

  // The pressed state after a partial scrub belongs to the slice alone:
  // a middle scrub is neither assembled nor open, so the toggle reads mixed.
  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'mixed',
  )
})

test('the toggle after a partial scrub completes the open, and the next press closes', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForExplodeMounted(page)

  const slider = sliderOf(page)
  await expect(slider).toBeEnabled()
  await slider.fill('0.5')
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'mixed',
  )

  await page.getByRole('button', { name: toggleLabel }).click()

  // The toggle acts from every state: from a partial scrub its press
  // completes the open. The slider's value is the target, so the thumb is
  // on the toggle's value at once, before the spring has moved. One read,
  // no poll: a poll would wait out the spring and hide the difference
  // between the target and the applied progress.
  expect(await slider.inputValue()).toBe('1')

  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(1)
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(1)
  await expect(readoutOf(page)).toHaveText('100%')
  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // The next press closes onto the assembled rest, like the plain toggle.
  await page.getByRole('button', { name: toggleLabel }).click()
  expect(await slider.inputValue()).toBe('0')
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  await expect(readoutOf(page)).toHaveText('0%')
  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('during the spring the readout and the value text say the applied progress', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForExplodeMounted(page)

  await sliderOf(page).fill('1')

  // One evaluation returns the applied progress and both texts together, so
  // the pair each comparison uses comes from one instant of the page. The
  // spring moves for its settle time, so a poll lands inside it; the last
  // sample inside the move is the one the assertions hold.
  const sampled: { reads: { t: number; readout: string; valueText: string } | null } = {
    reads: null,
  }
  await expect
    .poll(
      async () => {
        const reads = await page.evaluate(() => ({
          t: window.__viewer?.explode?.t ?? null,
          readout: document.querySelector('[data-explode-readout]')?.textContent ?? null,
          valueText:
            document.querySelector('input[type="range"]')?.getAttribute('aria-valuetext') ?? null,
        }))
        if (
          reads.t !== null &&
          reads.t > 0 &&
          reads.t < 1 &&
          reads.readout !== null &&
          reads.valueText !== null
        ) {
          sampled.reads = { t: reads.t, readout: reads.readout, valueText: reads.valueText }
        }
        return sampled.reads !== null
      },
      { timeout: testBodyBudgetMs },
    )
    .toBe(true)
  const sample = sampled.reads
  if (sample === null) {
    throw new Error('the spring offered no mid-motion sample')
  }

  // The readout is the formatted applied progress, not the target, and the
  // value text is the readout's own string.
  expect(sample.readout).toBe(formatExplodePercent(sample.t))
  expect(sample.valueText).toBe(sample.readout)
})

test('under reduced motion a scrub lands in its one frame, with the readout', async ({
  page,
  backendPath,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(backendPath)
  await waitForExplodeMounted(page)
  const before = await renderedFramesOf(page)

  await sliderOf(page).fill('0.5')

  // The jump applies the scrubbed pose itself and owes exactly the one frame
  // its invalidation presents, on which the spring is already at rest.
  await expect
    .poll(() => renderedFramesOf(page), {
      message: 'the scrub must render its one frame',
      timeout: testBodyBudgetMs,
    })
    .toBe(before + 1)

  await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(0.5)
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0.5)
  await expect(readoutOf(page)).toHaveText('50%')
  await expect(sliderOf(page)).toHaveAttribute('aria-valuetext', '50%')
})

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
  await expect(readoutOf(page)).toHaveText('50%')

  const remount = page.getByTestId('remount-product')

  // Unmount from the open state: the readout reaction's release publishes
  // idle, so nothing stale survives the view, and the control waits like
  // the toggle while no view is attached.
  await remount.click()
  await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
  await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
  await expectUnavailable(slider)
  await expect(slider).toHaveValue('0')
  await expect(readoutOf(page)).toHaveText('0%')

  // Remount: presented assembled again, the control live at the rest.
  await remount.click()
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  await expect(slider).toBeEnabled()
  await expect(slider).toHaveValue('0')
  await expect(readoutOf(page)).toHaveText('0%')
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

// The feature is mounted once the product is presented, so the automation
// reading exists and the stage is at rest on the assembled pose.
async function waitForExplodeMounted(page: Page): Promise<void> {
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  await settledFrames(page)
}
