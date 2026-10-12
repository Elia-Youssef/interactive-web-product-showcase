import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { expectProduct, openIndexAtRest, productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { scrollsAsDocument, viewportContracts } from './layoutContracts'
import { inside, overlaps, readReflowFacts } from './reflowFacts'
import { scrollToReveal } from './scrollToReveal'

// The layout reflows at every layout viewport, down to 320 px wide and to
// the 320 x 256 window of a 1280 px screen at 400 percent zoom, for every
// shipped product: nothing scrolls sideways, nothing spills past its box or
// is clipped by the layout shell, the stage chrome slots never collide
// whatever they hold, the panel reads in its document order, a phone's
// resting sheet shows the product's name and its finishes, and a window too
// short for the sheet scrolls as one document with no nested scroller.
const collection = await loadCollection()
const labels = { panel: siteCopy.panelLabel, stage: siteCopy.stageLabel }

for (const contract of viewportContracts) {
  const size = `${contract.width}x${contract.height}`
  for (const product of collection.products) {
    test(`reflow at ${size}: ${product.slug} fits the viewport, the chrome and the sheet`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize({ width: contract.width, height: contract.height })
      await page.goto(productPathOf(backendPath, product))
      await expectProduct(page, product)
      await page.evaluate(() => document.fonts.ready)
      const facts = await readReflowFacts(page, labels)

      // Nothing scrolls sideways, spills past its box or hides under the
      // layout shell's clip.
      expect
        .soft(facts.documentScrollWidth, 'the page scroll width')
        .toBeLessThanOrEqual(facts.viewport.width)
      expect.soft(facts.spills, 'elements whose content spills past their box').toEqual([])
      expect
        .soft(facts.layout.scrollWidth, 'the layout shell scroll width')
        .toBeLessThanOrEqual(facts.layout.clientWidth)
      expect
        .soft(facts.layout.scrollHeight, 'the layout shell scroll height')
        .toBeLessThanOrEqual(facts.layout.clientHeight)
      expect.soft(facts.topBarEscapes, 'top bar content outside the top bar').toEqual([])

      // The chrome slots stay inside the stage, hold their content, and
      // never share area with each other.
      for (const corner of facts.corners) {
        expect.soft(inside(corner.box, facts.stage), `${corner.name} inside the stage`).toBe(true)
        expect.soft(corner.contentFits, `${corner.name} holds its content`).toBe(true)
      }
      for (const [index, corner] of facts.corners.entries()) {
        for (const other of facts.corners.slice(index + 1)) {
          expect
            .soft(overlaps(corner.box, other.box), `${corner.name} clear of ${other.name}`)
            .toBe(false)
        }
      }

      // The panel reads top to bottom in its document order.
      for (const [index, row] of facts.panelRows.entries()) {
        const next = facts.panelRows[index + 1]
        if (next !== undefined) {
          expect
            .soft(next.box.top, `${next.name} below ${row.name}`)
            .toBeGreaterThanOrEqual(row.box.bottom)
        }
      }

      if (scrollsAsDocument(contract)) {
        // The window scrolls as one document: the panel holds all of its
        // content, so no scroller nests inside the page.
        expect
          .soft(facts.panel.scrollHeight, 'the panel holds its content with no scroll of its own')
          .toBeLessThanOrEqual(facts.panel.clientHeight)
      } else if (contract.breakpoint === 'phone') {
        // The resting sheet shows the product's name and its finishes.
        expect(facts.panel.scrollTop, 'the sheet at rest').toBe(0)
        const sheet = {
          ...facts.panel,
          bottom: Math.min(facts.panel.bottom, facts.viewport.height),
        }
        for (const item of facts.resting) {
          expect.soft(inside(item.box, sheet), `${item.name} in the resting sheet`).toBe(true)
        }
      }
    })
  }

  // The panel's last row comes into view by scrolling whichever scroller the
  // layout has, and lands inside the viewport.
  test(`reflow at ${size}: the end of the panel is reachable`, async ({ page, backendPath }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(productPathOf(backendPath, collection.first))
    await expectProduct(page, collection.first)
    const last = page
      .getByRole('complementary', { name: siteCopy.panelLabel })
      .locator('[data-slot="panel"] > * > *')
      .filter({ visible: true })
      .last()
    await scrollToReveal(last)
    await expect(last).toBeInViewport({ ratio: 1 })
  })

  // A title word longer than the panel's line breaks inside the panel
  // instead of pushing it sideways, whatever the manifest's words.
  test(`reflow at ${size}: a title word longer than its line breaks`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(productPathOf(backendPath, collection.first))
    await expectProduct(page, collection.first)
    const title = page.getByRole('heading', { level: 1 })
    await title.evaluate((heading) => {
      const brand = heading.firstElementChild
      if (brand === null) {
        throw new Error('the title must hold its brand line')
      }
      brand.textContent = 'W'.repeat(40)
    })
    const facts = await readReflowFacts(page, labels)
    expect(facts.spills, 'elements whose content spills past their box').toEqual([])
    expect(facts.documentScrollWidth, 'the page scroll width').toBeLessThanOrEqual(
      facts.viewport.width,
    )
  })

  // The index dialog fits the viewport and holds its rows without a
  // sideways scroll.
  test(`reflow at ${size}: the index dialog fits the viewport`, async ({ page, backendPath }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(productPathOf(backendPath, collection.first))
    await expectProduct(page, collection.first)
    const dialog = await openIndexAtRest(page)
    const fit = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        inViewport:
          box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        sideways: element.scrollWidth > element.clientWidth,
      }
    })
    expect(fit.inViewport, 'the dialog inside the viewport').toBe(true)
    expect(fit.sideways, 'the dialog scrolls sideways').toBe(false)
  })
}
