import { expect, test } from './fixtures'
import { referenceLayouts, reflowViewports } from './layoutContracts'
import { shippedProducts } from './productSpecs'
import { productPathOf } from './collectionFacts'
import { readyStage } from './stageKeys'
import { markerOf } from './hotspotViews'
import { checkChrome } from './hotspotChromeChecks'
import { completedPresentation, clickCompleted, revealCompleted } from './presentationCompletion'
import { highlightsButtonOf, itemOf } from './highlightsList'
import { focusVisibly } from './measurementFocus'
import { selectMarkersAtHome } from './markerSelection'

const products = (await shippedProducts()).filter((product) => product.hotspots.length > 0)
for (const viewport of [...referenceLayouts, ...reflowViewports]) {
  for (const product of products) {
    test(`chrome marker keep-out at ${viewport.width}x${viewport.height}: ${product.slug} hides complete collisions and lists their alternatives`, async ({
      page,
      backendPath,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await readyStage(page, productPathOf(backendPath, product))
      const hidden = await checkChrome(page, product)
      const eligible = await selectMarkersAtHome(page, product)
      const shown = product.hotspots.find((hotspot) => eligible.shown.has(hotspot.id))
      if (shown !== undefined) {
        await clickCompleted(page, markerOf(page, shown.title))
        await completedPresentation(page)
        await checkChrome(page, product)
        await page.keyboard.press('Escape')
        await completedPresentation(page)
      }
      if (hidden.length > 0) {
        await clickCompleted(page, highlightsButtonOf(page, product))
        for (const id of hidden) {
          const hotspot = product.hotspots.find((entry) => entry.id === id)
          if (hotspot === undefined)
            throw new Error('a projected hotspot must have a manifest item')
          const { button, card } = itemOf(page, hotspot.title)
          await revealCompleted(page, button)
          await focusVisibly(page, button)
          await page.keyboard.press('Enter')
          await expect(card.getByRole('heading', { level: 3, name: hotspot.title })).toBeVisible()
          await completedPresentation(page)
          expect(await page.evaluate(() => window.__viewer?.overlay?.card?.slot)).toBe('listed')
          await page.keyboard.press('Escape')
          await completedPresentation(page)
        }
      }
      await testInfo.attach('chrome-hidden-hotspots', {
        body: JSON.stringify(hidden),
        contentType: 'application/json',
      })
    })
  }
}
