import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

function renderedFrames(page: Page): Promise<number> {
  return page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
}

// How long the frame count must hold still before the stage counts as
// settled. A late layout or font load lands inside the window and keeps the
// poll running, so no fixed sleep precedes the at-rest measurement.
const settleWindowMs = 500

// Polls until the frame count is unchanged across a whole settle window and
// returns the count it settled on.
async function settledFrames(page: Page): Promise<number> {
  let reference = await renderedFrames(page)
  for (;;) {
    await page.waitForTimeout(settleWindowMs)
    const current = await renderedFrames(page)
    if (current === reference) {
      return current
    }
    reference = current
  }
}

test('the stage stands still at rest and renders again on a resize', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')
  await expect.poll(() => page.evaluate(() => window.__viewer?.ready)).toBe(true)

  // The stage's load work (model, camera fit, renderer compile) owes frames
  // of its own after ready; the at-rest measurement starts once it is in,
  // so the settle window below measures rest, not a late load frame.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), { timeout: 30000 })
    .not.toBeNull()

  // At rest under demand mode, with the HUD mounted: nothing renders for 2 s.
  const framesAtRest = await settledFrames(page)
  await page.waitForTimeout(2000)
  expect(await renderedFrames(page)).toBe(framesAtRest)

  // The HUD's rolling window has passed, so its FPS reads exactly zero.
  await expect(page.getByTestId('hud-fps')).toHaveText('0.0')

  // A viewport resize owes a frame, and the renderer renders it.
  await page.setViewportSize({ width: 900, height: 600 })
  await expect
    .poll(() => renderedFrames(page), 'the resize must render at least one frame')
    .toBeGreaterThan(framesAtRest)
})
