import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { expectProduct, productPathOf } from './collectionFacts'
import { settledFrames } from './stageSettle'
import { flowFacts } from './hotspotFlowFacts'
import { restWindowBudgetMs } from './budgets'

// The docked card fits the sheet's visible band on a phone held sideways:
// at 844x390 the band under the stage is a hundred pixels, too short for
// the full card, so the docked card takes its compact form there and the
// dock lands its top at the band's top. Every part of the open card is
// inside the viewport the moment it opens, and the explode control under
// the docked card stays reachable: the band scrolls to it and its toggle
// answers a press. The cases are every marker the stage shows at this
// size, close-up hotspots among them, for every routed product.

const WIDTH = 844
const HEIGHT = 390

const { flows } = await flowFacts()

for (const flow of flows) {
  const { product } = flow.subject
  const explodeLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
  test(`docked card sheet band: every open card of ${product.slug} fits the visible band at ${WIDTH}x${HEIGHT}, and the explode control stays reachable`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: WIDTH, height: HEIGHT })
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await settledFrames(page)

    // The cases are the markers that answer a press at their own center.
    // A stage this wide can crowd two markers onto each other so that
    // another marker takes the point (placeholder-speaker's driver under
    // its knob at this size on the base): that is the markers' own keep-out
    // question, outside the sheet band's contract, so those markers are not
    // cases here and the crowding is reported where it belongs.
    const shown = (
      await page.evaluate(() => {
        const markers = [...document.querySelectorAll('[data-slot="stage"] button[aria-pressed]')]
        return markers
          .filter((marker) => {
            const style = getComputedStyle(marker)
            if (style.visibility !== 'visible') {
              return false
            }
            const box = marker.getBoundingClientRect()
            const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
            return top === marker
          })
          .map((marker) => marker.getAttribute('aria-label'))
      })
    ).filter((label): label is string => label !== null)
    expect(
      shown.length,
      `${product.slug} must show a marker it can press at ${WIDTH}x${HEIGHT}`,
    ).toBeGreaterThan(0)

    for (const title of shown) {
      await page.getByRole('button', { name: title }).click()
      const card = page
        .getByRole('complementary', { name: siteCopy.panelLabel })
        .getByTestId('hotspot-card')
      await expect(card.getByRole('heading', { name: title })).toBeVisible()
      await settledFrames(page)

      // The whole card sits inside the viewport once the dock's scroll
      // lands: the header (eyebrow and close button), the title and every
      // bullet, edges included.
      await expectFullyInsideViewport(HEIGHT, [
        card.locator('[class*="eyebrow"]'),
        card.getByRole('button', { name: siteCopy.closeLabel }),
        card.getByRole('heading'),
        card.getByRole('listitem'),
      ])

      // The explode control under the docked card is reachable: the band
      // scrolls to it and the toggle answers a press.
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

// Each named locator lies fully inside the viewport's height, edges
// included, on the browser's layout grid; the half pixel tolerates the
// grid's fraction while the dock's smooth scroll settles.
async function expectFullyInsideViewport(
  viewportHeight: number,
  parts: readonly Locator[],
): Promise<void> {
  for (const part of parts) {
    await expect
      .poll(
        async () => {
          const box = await part.first().boundingBox()
          if (box === null) {
            return false
          }
          return box.y >= -0.5 && box.y + box.height <= viewportHeight + 0.5
        },
        { timeout: restWindowBudgetMs },
      )
      .toBe(true)
    const count = await part.count()
    if (count > 1) {
      const box = await part.last().boundingBox()
      if (box === null) {
        throw new Error('the last of many parts must have a box')
      }
      expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight + 0.5)
    }
  }
}
