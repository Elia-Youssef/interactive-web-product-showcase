import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { holdAsset } from './heldAssetRoute'
import { expectPoll, productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { renderedFramesOf, settledFrames } from './stageSettle'
import { expectFocusOn, expectUnavailable } from './stageKeys'
import { focusVisibly } from './measurementFocus'
import { resolvedTokenColor } from './tokenColor'
import { productModelUrl } from '../../src/lib/product'
import { formatExplodePercent, highlightsLabel } from '../../src/lib/copy/productPanel'
import { product, readoutOf, scrubName, sliderOf, toggleLabel } from './explodeScrubSection'

// The exploded view's scrub control on the app's panel: the slider under
// the toggle and its mono readout, while the section waits and once the
// product answers. The mount lifecycle proofs live on the dev harness, in
// explodeScrubMount.spec.ts beside this spec. The slider is driven through
// the real input, so the native contract (fill, value, value text) is the
// one under test, and every text the readout shows is held to the panel's
// own format function, imported here, so the display rule has no second
// copy in the spec.

test('before the product is presented the section waits unavailable and reads 0%', async ({
  page,
  backendPath,
}) => {
  // The model request is held, so the waiting state the test reads is the
  // one on the page for as long as the test reads it.
  const model = await holdAsset(page, productModelUrl(product.slug))
  try {
    await page.goto(backendPath)
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)

    // The panel renders with the route, before any model presents. Nothing
    // is attached, so the control waits like the toggle does, at the
    // assembled rest: the thumb at 0 and the readout at 0%.
    const slider = sliderOf(page)
    await expectUnavailable(slider)
    await expect(slider).toHaveValue('0')
    await expect(slider).toHaveAttribute('aria-valuetext', '0%')
    await expect(readoutOf(page)).toHaveText('0%')

    // The waiting toggle reads as a waiting control: the one disabled color
    // the waiting controls share, a different word of the palette than the
    // label color a rest button carries, so the disabled state is visible
    // and not color-alone (the cursor with it).
    const toggle = page.getByRole('button', { name: toggleLabel })
    await expectUnavailable(toggle)
    await expect(toggle).toHaveCSS('color', await resolvedTokenColor(page, '--disabled'))
  } finally {
    model.release()
  }
})

test('the waiting section keeps the keyboard focus and ignores activation until the product presents', async ({
  page,
  backendPath,
}) => {
  // The model request is held for the waiting half, so the keys land on a
  // section that waits no matter how fast the load would otherwise be.
  const model = await holdAsset(page, productModelUrl(product.slug))
  try {
    await page.goto(backendPath)
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
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

    // The load continues: the product presents, both controls answer again,
    // the focus never having left the section, and the toggle opens the
    // view from the keys.
    model.release()
    await waitForProductReady(page)
    await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
    await expect(toggle).not.toHaveAttribute('aria-disabled')
    await expect(slider).not.toHaveAttribute('aria-disabled')
    await focusVisibly(page, toggle)
    await page.keyboard.press('Enter')
    await expectFocusOn(toggle, 'the toggle keeps the focus it opens the view from')
    await expectPoll(page, () => window.__viewer?.explode?.target, testBodyBudgetMs).toBe(1)
  } finally {
    model.release()
  }
})

test('the waiting scrub is no keyboard trap: its tab keys leave it, its value keys move nothing', async ({
  page,
  backendPath,
}) => {
  // The model request is held for the whole test, so the section waits no
  // matter how fast the machine is: the hold is the suite's clock-free way
  // to keep a product from presenting, and the trap cannot hide behind a
  // load that wins the race against the keys.
  const model = await holdAsset(page, productModelUrl(product.slug))
  try {
    await page.goto(backendPath)
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)

    const toggle = page.getByRole('button', { name: toggleLabel })
    const slider = sliderOf(page)
    // The panel's next focusable element after the scrub is the Highlights
    // disclosure that opens the next section; the previous one is the
    // toggle.
    const highlights = page.getByRole('button', {
      name: highlightsLabel(product.hotspots.length),
    })

    await expectUnavailable(slider)

    // Tab leaves the waiting scrub for the next focusable element, and
    // Shift+Tab comes back to it and leaves it the other way: the focus is
    // never trapped on a waiting control.
    await focusVisibly(page, slider)
    await expectFocusOn(slider, 'the waiting scrub takes the keyboard focus')
    await page.keyboard.press('Tab')
    await expectFocusOn(highlights, 'Tab leaves the waiting scrub for the next control')
    await page.keyboard.press('Shift+Tab')
    await expectFocusOn(slider, 'Shift+Tab returns to the waiting scrub')
    await page.keyboard.press('Shift+Tab')
    await expectFocusOn(toggle, 'Shift+Tab leaves the waiting scrub for the previous control')

    // The value keys still move nothing while it waits.
    await focusVisibly(page, slider)
    await page.keyboard.press('ArrowDown')
    await expect(slider).toHaveValue('0')
    await expect(readoutOf(page)).toHaveText('0%')
    await expectFocusOn(slider, 'the waiting scrub keeps the focus under its value keys')

    // The waiting input carries no readonly: the standard forbids the
    // attribute on a range input.
    await expect(slider).not.toHaveAttribute('readonly')
  } finally {
    model.release()
  }
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

// The feature is mounted once the product is presented, so the automation
// reading exists and the stage is at rest on the assembled pose.
async function waitForExplodeMounted(page: Page): Promise<void> {
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  await settledFrames(page)
}
