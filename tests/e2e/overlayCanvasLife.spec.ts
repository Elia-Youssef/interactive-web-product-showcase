import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { expectMarkersAtProjection, markerOf } from './hotspotViews'
import { frameFaultPath, pollProductChannel, remountProduct } from './productFailureChannel'
import { harnessProducts, waitForProductReady } from './productSpecs'
import {
  expectProductRetirementReports,
  observeEnvironmentSettleFailures,
} from './environmentSettleReports'
import { settledFrames } from './stageSettle'
import { frameFaultMessage } from '../../src/app/product-harness/frameFaultQuery.ts'
import { overlayKey } from '../../src/lib/hotspots/hotspotKeys.ts'

// The marker overlay across a canvas life. A present that throws retires
// the stage's renderer, and the next product life presents on a fresh
// canvas. The overlay outlives no canvas: a placement is written only by a
// frame that presented, so the failed life holds none, and the fresh
// canvas's own post-present phase places every marker of the remounted
// product at its projection, with nothing left of the failed life. The
// harness's frame fault rides the page's first product mount only, so the
// toggle's remount is new, clean content.

const products = await harnessProducts()

// The placements the stage's overlay channel holds right now, through the
// automation's overlay probe, which reads the channel of the canvas life
// on the stage.
async function overlayPlacements(page: Page) {
  const overlay = await page.evaluate(() => window.__viewer?.overlay ?? null)
  if (overlay === null) {
    throw new Error('the overlay probe must be registered while the stage shows a canvas life')
  }
  return overlay.placements
}

for (const product of products) {
  test(`a present fault under ${product.slug} leaves no marker placed, and the remount places every marker at its projection on a fresh canvas`, async ({
    page,
    backendPath,
    consoleGate,
  }) => {
    // Two product loads: the faulted mount, then the remount after it.
    test.setTimeout(testBudgetMs({ productLoads: 2 }))

    await observeEnvironmentSettleFailures(page)
    await page.goto(frameFaultPath(backendPath, product.slug, 'present', 'product'))
    await pollProductChannel(page).toEqual({
      product: 'failed',
      productSlug: product.slug,
      failure: { kind: 'render', message: frameFaultMessage('present') },
      status: 'ready',
    })

    // No frame of the failed product presented, so its overlay holds no
    // placement and shows no marker: a pass written on the frame whose
    // present threw would leave its keys here.
    expect(await overlayPlacements(page), 'the failed life holds no placement').toEqual({})
    for (const hotspot of product.hotspots) {
      await expect(markerOf(page, hotspot.title)).toHaveCount(0)
    }
    const retiredCanvas = await page.locator('canvas').elementHandle()
    if (retiredCanvas === null) {
      throw new Error('the failed product must stand on a canvas')
    }

    await remountProduct(page)
    await waitForProductReady(page)
    await settledFrames(page)

    // The remount presents on a fresh canvas: the retired one has left the
    // page.
    expect(
      await retiredCanvas.evaluate((canvas) => canvas.isConnected),
      'the retired canvas has left the page',
    ).toBe(false)
    // Every marker of the remounted product, and only those, is placed by
    // the fresh canvas, at its anchor's projection.
    expect(
      Object.keys(await overlayPlacements(page)).sort(),
      'the fresh overlay holds one placement per marker and nothing else',
    ).toEqual(product.hotspots.map((hotspot) => overlayKey(hotspot.id)).sort())
    for (const hotspot of product.hotspots) {
      await expect(markerOf(page, hotspot.title)).toHaveCount(1)
    }
    await expectMarkersAtProjection(page, product.hotspots, 'on the fresh canvas')
    await expectProductRetirementReports(page, consoleGate)
  })
}
