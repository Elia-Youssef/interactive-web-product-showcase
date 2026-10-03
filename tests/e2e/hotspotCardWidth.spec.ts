import { expect, test } from './fixtures'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { openCardOf, tokenPx } from './hotspotCardChecks'

// The floating card lays out at its content's width, clamped by the card
// width token, for every hotspot of every product. The widths compare
// exactly: the card and two clones of it lay out under the same parent, so
// identical content gives identical widths on every engine, read from the
// resize observer's border box, the layout's own size before any transform
// or pixel snapping. One clone drops the clamp and measures the content's
// own width; the other carries a title lengthened past the token and must
// lay out at exactly the token, which proves the clamp. The copy rules give
// the title and every bullet one line.

const products = await harnessProducts()

for (const product of products) {
  for (const hotspot of product.hotspots) {
    test(`card width ${product.slug}: the card of ${hotspot.title} lays out at its content width clamped by the token, one line per title and bullet`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, product.slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, hotspot.title).click()
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      await settledFrames(page)
      const card = openCardOf(page)
      await expect(
        page.locator('[data-slot="dock"]').getByTestId('hotspot-card'),
        'the width check reads the floating card, so the card must not be docked',
      ).toHaveCount(0)

      const widths = await card.evaluate(async (wrapper) => {
        const parent = wrapper.parentElement
        const heading = wrapper.querySelector('h2')
        if (parent === null || heading === null) {
          throw new Error('the floating card must have a parent and a title heading')
        }
        const unclamped = wrapper.cloneNode(true)
        const lengthened = wrapper.cloneNode(true)
        if (!(unclamped instanceof HTMLElement) || !(lengthened instanceof HTMLElement)) {
          throw new Error('the floating card clones must be elements')
        }
        unclamped.style.maxInlineSize = 'none'
        const lengthenedHeading = lengthened.querySelector('h2')
        if (lengthenedHeading === null) {
          throw new Error('the lengthened clone must carry the title heading')
        }
        lengthenedHeading.textContent = `${heading.textContent ?? ''} `.repeat(8).trim()
        for (const clone of [unclamped, lengthened]) {
          clone.style.visibility = 'hidden'
          clone.removeAttribute('data-testid')
          parent.appendChild(clone)
        }
        const elements = [wrapper, unclamped, lengthened]
        const sizes = await new Promise<number[]>((resolve) => {
          const observer = new ResizeObserver((entries) => {
            observer.disconnect()
            resolve(
              elements.map((element) => {
                const entry = entries.find((candidate) => candidate.target === element)
                const size = entry?.borderBoxSize[0]
                if (size === undefined) {
                  throw new Error('every observed card must report a border box')
                }
                return size.inlineSize
              }),
            )
          })
          for (const element of elements) {
            observer.observe(element)
          }
        })
        unclamped.remove()
        lengthened.remove()
        // One line box per line: a range over an element's text answers one
        // rectangle per line it lays out on.
        const lines = [heading, ...wrapper.querySelectorAll('li')].map((element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          return range.getClientRects().length
        })
        const [card, content, clamped] = sizes
        if (card === undefined || content === undefined || clamped === undefined) {
          throw new Error('the observer must answer all three widths')
        }
        return { card, content, clamped, lines }
      })

      const maxPx = await tokenPx(page, '--size-hotspot-card-max')
      expect(widths.clamped, `a title past the token must lay out at the ${maxPx}px token`).toBe(
        maxPx,
      )
      expect(
        widths.card,
        `the card must lay out at its content width clamped by the ${maxPx}px token`,
      ).toBe(Math.min(widths.content, maxPx))
      expect(widths.lines, 'the title and every bullet lay out on one line').toEqual(
        widths.lines.map(() => 1),
      )
    })
  }
}
