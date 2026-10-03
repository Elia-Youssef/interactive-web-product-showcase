import { expect, test } from './fixtures'
import { testBodyBudgetMs } from './budgets'
import { countDifferingPixels } from './lookPixels'
import { loadCollection } from './productList'
import { harnessPath, waitForProductReady } from './productSpecs'
import { settledStageCapture } from './stageCapture'
import type { RegionBox } from './stagePixels'
import { countRegionPixelsBrighterThan, decodeScreenshotRGBA } from './stagePixels'
import { settledStage } from './stageSettle'

// The contract of the suite's settled capture helper, proven at the moments
// the caller-ordered waits used to race: right after a finish switch, when
// the dev HUD's rolling window is still draining and its content-sized mask
// box is about to shrink, and right after a load, when the markers'
// first-load pulse is still running on CSS time. After the helper returns,
// the HUD must read its rest values and no one-time animation may run, and
// captures taken across the drain must be pixel-identical. The harness
// extension masks every control the harness lays over the stage.

const product = (await loadCollection()).first

test('a stage capture returns with the HUD at rest and repeats pixel-exact across a finish switch', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForProductReady(page)

  const otherFinish = product.finishes[1]
  if (otherFinish === undefined) {
    throw new Error('a product with one finish has no finish switch to race the capture with')
  }

  await page.getByRole('button', { name: otherFinish.label }).click()
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.finish?.applied ?? null), {
      timeout: testBodyBudgetMs,
    })
    .toBe(otherFinish.variant)

  // Two captures back to back, with no wait of the test's own between them:
  // the order that raced when the wait was every spec's to remember.
  const first = await settledStageCapture(page)

  // After the helper returns, the HUD reads its rest values. One read each,
  // with no retry, right after the first capture: a helper that captures
  // before the drain gets here with the live values still on the HUD. This
  // read is the deterministic check; the pixel comparisons below fail only
  // when the drain shortens the widest HUD row between two shots.
  expect(await page.getByTestId('hud-fps').textContent()).toBe('0.0')
  expect(await page.getByTestId('hud-tick-cpu').textContent()).toBe('-')

  const second = await settledStageCapture(page)

  // The suite's own rest condition, applied by the test as the oracle: from
  // here on, a helper capture is the reference of a fully drained stage, so
  // a capture that went out before the drain cannot match it.
  await settledStage(page)
  const reference = await settledStageCapture(page)

  const decodedFirst = await decodeScreenshotRGBA(page, first)
  const decodedSecond = await decodeScreenshotRGBA(page, second)
  const decodedReference = await decodeScreenshotRGBA(page, reference)
  const wholeFrame: RegionBox = {
    x: 0,
    y: 0,
    width: decodedFirst.width,
    height: decodedFirst.height,
  }
  expect(
    countDifferingPixels(decodedFirst, decodedSecond, wholeFrame).count,
    'the back-to-back captures of one settled state must be pixel-identical',
  ).toBe(0)
  expect(
    countDifferingPixels(decodedFirst, decodedReference, wholeFrame).count,
    'a capture from before the HUD drain shows a different mask box than the reference',
  ).toBe(0)
})

test('a stage capture right after the load returns with every one-time animation finished', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await waitForProductReady(page)

  await settledStageCapture(page)

  // One read, with no retry, right after the capture: a helper that shoots
  // before the markers' first-load pulse has ended gets here with the pulse
  // still running.
  const running = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
  )
  expect(running, 'the settled capture shot while a one-time animation was running').toBe(0)
})

test('a harness capture masks every control the harness lays over the stage', async ({
  page,
  backendPath,
}) => {
  await page.goto(harnessPath(backendPath, product.slug))
  await waitForProductReady(page)

  const capture = await settledStageCapture(page, ['harnessControls'])

  // The oracle is the page's own controls, found by their roles rather than
  // by the mark the mask reads: every button and slider the harness shows
  // must come out of the capture as the mask color, so a control the
  // harness gains without the mark fails here.
  const controls = [
    ...(await page.getByRole('button').all()),
    ...(await page.getByRole('slider').all()),
  ]
  expect(controls.length, 'the harness must show its controls').toBeGreaterThan(0)
  for (const control of controls) {
    const box = await control.boundingBox()
    if (box === null) {
      throw new Error('every harness control must have a bounding box')
    }
    const name = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? ''
    const unmasked = await countRegionPixelsBrighterThan(page, capture, box, 0)
    expect(unmasked.count, `the harness control '${name}' must be masked`).toBe(0)
  }
})
