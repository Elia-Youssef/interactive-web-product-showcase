import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { productEyebrow, productEyebrowText } from '../../src/lib/product'
import { productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { viewportContracts } from './layoutContracts'

// The product eyebrow closes with the serial the site composes from the
// product number, and the serial never sits alone on a line: the separator
// and the digits are one fragment that lays out on one line, and the line
// breaks before it rather than let it run past the eyebrow, at every
// layout viewport and for every shipped product. A DOM check, so it waits
// for the panel's words only, never for a model.
const collection = await loadCollection()

for (const contract of viewportContracts) {
  for (const product of collection.products) {
    test(`the eyebrow of ${product.slug} keeps its serial whole at ${contract.width}x${contract.height}`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize({ width: contract.width, height: contract.height })
      await page.goto(productPathOf(backendPath, product))

      const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
      const eyebrow = panel.getByText(productEyebrowText(product), { exact: true })
      await expect(eyebrow).toBeVisible()
      await page.evaluate(() => document.fonts.ready)

      const tail = eyebrow.locator('[data-eyebrow-tail]')
      await expect(tail).toHaveText(productEyebrow(product).tail)
      const lineBoxes = await tail.evaluate((element) => element.getClientRects().length)
      expect(lineBoxes, 'the serial lays out on one line').toBe(1)
      // The line breaks before the serial when the two do not fit: the
      // serial never runs past the eyebrow's own box.
      const spill = await eyebrow.evaluate((element) => element.scrollWidth - element.clientWidth)
      expect(spill, 'the eyebrow spills past its box').toBeLessThanOrEqual(0)
    })
  }
}
