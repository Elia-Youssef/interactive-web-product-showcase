import { hotspotTestProducts } from './hotspotTestProducts'
import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { expectProduct, productPathOf } from './collectionFacts'
import { clickCompleted, completedPresentation, revealCompleted } from './presentationCompletion'
import { loadCollection } from './productList'
import { testBudgetMs } from './budgets'
import { selectMarkersAtHome } from './markerSelection'
import { openChromeAlternative } from './chromeAlternative'
import { expectCardPartsInsideBand } from './cardBand'
import { expectCloseAnswers } from './hotspotCardOracle'
import { markerOf } from './hotspotViews'
import type { Page } from '@playwright/test'

// The docked card fits the sheet's visible band on a phone held sideways:
// at 844x390 the band under the stage is a hundred pixels, too short for
// the full card, so the docked card takes its compact form there and the
// dock lands its top at the band's top. Every part of the stage card is
// inside the panel band after its native scroll. The compact dock stays readable
// when its marker loses placement.
// The explode control stays reachable: the band scrolls to it and its toggle
// can receive a press. The cases are every marker the stage shows at this
// size, close-up hotspots among them, for every routed product.

const WIDTH = 844
const HEIGHT = 390

const collection = await loadCollection()

for (const product of hotspotTestProducts(collection.products, 'docked card sheet')) {
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
  test(`docked card sheet band: every stage card of ${product.slug} retains full band geometry at ${WIDTH}x${HEIGHT}, and chrome alternatives and the explode control stay reachable`, async ({
    page,
    backendPath,
  }, testInfo) => {
    test.setTimeout(testBudgetMs({ productLoads: 1, cameraDrives: product.hotspots.length * 2 }))
    await page.setViewportSize({ width: WIDTH, height: HEIGHT })
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await completedPresentation(page)

    // Keyboard activation reaches every shown marker even when two pointer
    // hit areas overlap, so crowding cannot omit a card from the band proof.
    const read = await selectMarkersAtHome(page, product)
    const shown = product.hotspots
      .filter((hotspot) => read.shown.has(hotspot.id))
      .map((hotspot) => hotspot.title)
    if (shown.length === 0) {
      for (const hotspot of product.hotspots) {
        expect(read.chromeHidden, 'chrome explains every absent marker at home').toContain(
          hotspot.id,
        )
        await openChromeAlternative(page, product, hotspot)
        const card = page.getByTestId('hotspot-card')
        await completedPresentation(page)
        await expectCardPartsInsideBand([
          card.getByRole('heading'),
          card.getByRole('button', { name: siteCopy.closeLabel }),
        ])
        await expectCloseAnswers(page)
        await expectExplodeReachable(page, explodeLabel)
        await clickCompleted(page, card.getByRole('button', { name: siteCopy.closeLabel }))
        await completedPresentation(page)
      }
    }
    await testInfo.attach('short-sheet-subjects', {
      body: JSON.stringify({
        slug: product.slug,
        shown,
        chromeHidden: read.chromeHidden,
        route: shown.length === 0 ? 'Highlights' : 'markers',
      }),
      contentType: 'application/json',
    })

    for (const title of shown) {
      await markerOf(page, title).focus()
      await page.keyboard.press('Enter')
      const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
      const card = panel.getByTestId('hotspot-card')
      await completedPresentation(page)
      await expect(card).toHaveCount(1)
      await expect(card.getByRole('heading', { name: title })).toBeVisible()
      await revealCompleted(page, card)

      // The whole card sits inside the panel band once the dock's scroll
      // lands: the header (eyebrow and close button), the title and every
      // bullet, edges included.
      await expectCardPartsInsideBand([
        card.locator('[class*="eyebrow"]'),
        card.getByRole('button', { name: siteCopy.closeLabel, includeHidden: true }),
        card.getByRole('heading', { includeHidden: true }),
        card.getByRole('listitem', { includeHidden: true }),
      ])
      await revealCompleted(page, card.getByRole('button', { name: siteCopy.closeLabel }))
      await expectCloseAnswers(page)

      // The explode control under the docked card is reachable: the band
      // scrolls to it and the toggle passes a real pointer actionability check.
      await expectExplodeReachable(page, explodeLabel)

      await clickCompleted(page, card.getByRole('button', { name: siteCopy.closeLabel }))
      await expect(card).toHaveCount(0)
      // A close-up leaves its camera behind, which can hide the next
      // case's marker; home is where the shown set was collected, so each
      // case starts there, the way a visitor reaches the next marker.
      await page.getByRole('button', { name: siteCopy.resetLabel }).click()
      await completedPresentation(page)
    }
  })
}

async function expectExplodeReachable(page: Page, label: string): Promise<void> {
  const explode = page.getByRole('button', { name: label })
  await revealCompleted(page, explode)
  await expect(explode).toBeInViewport()
  await expect(explode).toBeEnabled()
  await explode.click({ trial: true })
}
