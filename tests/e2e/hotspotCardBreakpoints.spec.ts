import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { expectProduct, productPathOf } from './collectionFacts'
import { settledFrames } from './stageSettle'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { flowFacts } from './hotspotFlowFacts'
import { phoneLandscape, viewportContracts } from './layoutContracts'
import { expectCardWhereTheLayoutPutsIt } from './hotspotCardOracle'

// An open card follows the layout across breakpoints: opened where cards
// float, it docks into the sheet once the window narrows to the phone
// layout, goes where the rule puts it on a phone held sideways (docked, in
// view, when the short stage leaves no side clear), and hangs beside its
// marker again once the window is wide. The card stays open throughout; a
// plain hotspot keeps the camera at home, so only the layout moves. Every
// routed product with a plain hotspot runs the same layout transition.

const { flows } = await flowFacts()

const floating = viewportContracts.find((contract) => contract.hotspotCard === 'floats')
const docking = viewportContracts.find((contract) => contract.hotspotCard === 'docks')
if (floating === undefined || docking === undefined) {
  throw new Error('the viewport contracts must hold a floating and a docking layout')
}
const route = [floating, docking, phoneLandscape, floating] as const

for (const flow of flows) {
  const { product } = flow.subject
  const titles = product.hotspots.map((hotspot) => hotspot.title)
  for (const plain of flow.subject.plains.slice(0, 1)) {
    const sizes = route.map((size) => `${size.width}x${size.height}`).join(', then ')
    test(`card across breakpoints: ${product.slug} the open card of ${plain.title} goes where each layout puts it at ${sizes}`, async ({
      page,
      backendPath,
    }) => {
      const [first] = route
      await page.setViewportSize({ width: first.width, height: first.height })
      await page.goto(productPathOf(backendPath, product))
      await expectProduct(page, product)
      await settledFrames(page)
      await markerOf(page, plain.title).click()
      await expect(cardHeadingOf(page, plain.title)).toBeVisible()

      for (const size of route) {
        await resizeTo(page, size)
        await expect(
          markerOf(page, plain.title),
          `the card stays open at ${size.width}x${size.height}`,
        ).toHaveAttribute('aria-pressed', 'true')
        await expectCardWhereTheLayoutPutsIt(page, size.hotspotCard, plain.title, titles)
      }
    })
  }
}

// Resizes the window and waits for the stage to come to rest at the new
// size: the resize renders the stage again, and the card decides on that
// frame's pass.
async function resizeTo(
  page: Page,
  size: { readonly width: number; readonly height: number },
): Promise<void> {
  await page.setViewportSize({ width: size.width, height: size.height })
  await settledFrames(page)
}
