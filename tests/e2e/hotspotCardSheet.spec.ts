import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { expectProduct, productPathOf } from './collectionFacts'
import { settledFrames } from './stageSettle'
import { loadCollection } from './productList'
import { restWindowBudgetMs } from './budgets'
import { expectCloseAnswers } from './hotspotCardOracle'

// The docked card fits the sheet's visible band on a phone held sideways:
// at 844x390 the band under the stage is a hundred pixels, too short for
// the full card, so the docked card takes its compact form there and the
// dock lands its top at the band's top. Every part of the open card is
// inside the panel band the moment it opens, and the explode control under
// the docked card stays reachable: the band scrolls to it and its toggle
// can receive a press. The cases are every marker the stage shows at this
// size, close-up hotspots among them, for every routed product.

const WIDTH = 844
const HEIGHT = 390

const collection = await loadCollection()

for (const product of collection.products) {
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
  test(`docked card sheet band: every open card of ${product.slug} fits the visible band at ${WIDTH}x${HEIGHT}, and the explode control stays reachable`, async ({
    page,
    backendPath,
  }, testInfo) => {
    await page.setViewportSize({ width: WIDTH, height: HEIGHT })
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await settledFrames(page)

    // Keyboard activation reaches every shown marker even when two pointer
    // hit areas overlap, so crowding cannot omit a card from the band proof.
    const shown = (
      await page.evaluate(() => {
        const markers = [...document.querySelectorAll('[data-slot="stage"] button[aria-pressed]')]
        return markers
          .filter((marker) => getComputedStyle(marker).visibility === 'visible')
          .map((marker) => marker.getAttribute('aria-label'))
      })
    ).filter((label): label is string => label !== null)
    expect(
      shown.length,
      `${product.slug} must show a marker it can press at ${WIDTH}x${HEIGHT}`,
    ).toBeGreaterThan(0)
    await testInfo.attach('short-sheet-subjects', {
      body: JSON.stringify({ slug: product.slug, shown }),
      contentType: 'application/json',
    })

    for (const title of shown) {
      await page.getByRole('button', { name: title }).focus()
      await page.keyboard.press('Enter')
      const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
      const card = panel.getByTestId('hotspot-card')
      await expect(card.getByRole('heading', { name: title })).toBeVisible()
      await settledFrames(page)

      // The whole card sits inside the panel band once the dock's scroll
      // lands: the header (eyebrow and close button), the title and every
      // bullet, edges included.
      await expectFullyInsideBand(panel, HEIGHT, [
        card.locator('[class*="eyebrow"]'),
        card.getByRole('button', { name: siteCopy.closeLabel }),
        card.getByRole('heading'),
        card.getByRole('listitem'),
      ])
      await expectCloseAnswers(page)

      // The explode control under the docked card is reachable: the band
      // scrolls to it and the toggle passes a real pointer actionability check.
      const explode = page.getByRole('button', { name: explodeLabel })
      await explode.scrollIntoViewIfNeeded()
      await expect(explode).toBeInViewport()
      await expect(explode).toBeEnabled()
      await explode.click({ trial: true })

      await card.getByRole('button', { name: siteCopy.closeLabel }).click()
      await expect(card).toHaveCount(0)
      // A close-up leaves its camera behind, which can hide the next
      // case's marker; home is where the shown set was collected, so each
      // case starts there, the way a visitor reaches the next marker.
      await page.getByRole('button', { name: siteCopy.resetLabel }).click()
      await settledFrames(page)
    }
  })
}

// Every part lies inside the panel's scrollport intersected with the
// viewport. A part above the panel can still be inside the viewport while
// clipped by the panel. The existing half-pixel layout-grid bound remains.
async function expectFullyInsideBand(
  panel: Locator,
  viewportHeight: number,
  parts: readonly Locator[],
): Promise<void> {
  for (const part of parts) {
    const count = await part.count()
    if (count === 0) {
      throw new Error('every named card part must be present in the band')
    }
    for (let index = 0; index < count; index++) {
      await expect
        .poll(
          async () => {
            const [band, box] = await Promise.all([
              panel.boundingBox(),
              part.nth(index).boundingBox(),
            ])
            if (band === null || box === null) {
              return false
            }
            const top = Math.max(0, band.y)
            const bottom = Math.min(viewportHeight, band.y + band.height)
            return box.y >= top - 0.5 && box.y + box.height <= bottom + 0.5
          },
          { timeout: restWindowBudgetMs },
        )
        .toBe(true)
    }
  }
}
