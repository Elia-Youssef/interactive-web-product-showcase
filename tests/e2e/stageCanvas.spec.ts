import type { Browser, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { observePageErrors } from './pageErrors'
import { testBodyBudgetMs } from './budgets'
import { productLoadBudgetMs } from './productSpecs'

// The stage's DPR contract at the display extremes: the drawing buffer is
// the CSS box times the device pixel ratio,
// clamped to the stage's [1, 2] window. A 3x display must not triple the
// fill rate, and a 1x display must keep its sharpness. Each raw context
// carries the console gate by hand, since the fixture gates the project page
// only.
const dprClampCases = [
  {
    deviceScaleFactor: 1,
    expectedBufferScale: 1,
    note: 'stays at 1x',
  },
  {
    deviceScaleFactor: 3,
    expectedBufferScale: 2,
    note: 'clamps to the 2x upper bound',
  },
] as const

for (const dprCase of dprClampCases) {
  test(`the drawing buffer follows a ${dprCase.deviceScaleFactor}x display ${dprCase.note}`, async ({
    page,
    baseURL,
    backendPath,
  }) => {
    const scaled = await rawScaledPage(page.context().browser(), baseURL, dprCase.deviceScaleFactor)
    const { ledger, stop } = observePageErrors(scaled)

    try {
      await scaled.setViewportSize({ width: 1000, height: 700 })
      await scaled.goto(backendPath)
      await expect
        .poll(() => scaled.evaluate(() => window.__viewer?.status), {
          timeout: productLoadBudgetMs,
        })
        .toBe('ready')

      const canvasBox = await scaled.locator('[data-slot="stage"] canvas').boundingBox()
      if (canvasBox === null) {
        throw new Error('the stage canvas must have a bounding box')
      }
      const buffer = await scaled.evaluate(() => {
        const canvas = document.querySelector('canvas')
        if (canvas === null) {
          throw new Error('the stage canvas is missing')
        }
        return {
          width: canvas.width,
          height: canvas.height,
          devicePixelRatio: window.devicePixelRatio,
        }
      })
      expect(buffer.devicePixelRatio).toBe(dprCase.deviceScaleFactor)
      // The one pixel of slack is the renderer's integer rounding of the
      // buffer; a dropped clamp is off by a whole display scale, not by one.
      expect(
        Math.abs(buffer.width - canvasBox.width * dprCase.expectedBufferScale),
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(buffer.height - canvasBox.height * dprCase.expectedBufferScale),
      ).toBeLessThanOrEqual(1)
    } finally {
      try {
        await stop()
      } finally {
        await scaled.close()
      }
    }
    const verdict = ledger.verdict()
    expect(verdict.unexpected, 'the page stayed clean during the test').toEqual([])
    expect(verdict.unmet, 'every expected page error appeared').toEqual([])
  })
}

async function rawScaledPage(
  browser: Browser | null,
  baseURL: string | undefined,
  deviceScaleFactor: number,
): Promise<Page> {
  if (browser === null) {
    throw new Error('the project page runs inside a browser')
  }
  if (baseURL === undefined) {
    throw new Error('the project carries a baseURL for its backend path')
  }
  return browser.newContext({ baseURL, deviceScaleFactor }).then((context) => context.newPage())
}

test('a resize across a breakpoint renders again and fills the new slot', async ({
  page,
  backendPath,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(backendPath)
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')

  // The model's own post-load frame settles first, so the frame the resize
  // owes is provably the resize's, not the load's.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      timeout: productLoadBudgetMs,
    })
    .not.toBeNull()
  const framesBefore = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)

  await page.setViewportSize({ width: 390, height: 844 })

  await expect
    .poll(() => page.evaluate(() => window.__viewer?.renderedFrames ?? -1), {
      message: 'the resize must render at least one frame under demand mode',
      timeout: testBodyBudgetMs,
    })
    .toBeGreaterThan(framesBefore)

  const slotBox = await page.locator('[data-slot="stage"]').boundingBox()
  const canvasBox = await page.locator('[data-slot="stage"] canvas').boundingBox()
  if (slotBox === null || canvasBox === null) {
    throw new Error('the stage slot and its canvas must have bounding boxes')
  }
  expect(canvasBox.x).toBeCloseTo(slotBox.x, 1)
  expect(canvasBox.y).toBeCloseTo(slotBox.y, 1)
  expect(canvasBox.width).toBeCloseTo(slotBox.width, 1)
  expect(canvasBox.height).toBeCloseTo(slotBox.height, 1)
})
