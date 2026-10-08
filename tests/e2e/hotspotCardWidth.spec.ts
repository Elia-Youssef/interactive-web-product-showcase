import { expect, test } from './fixtures'
import { harnessPath, harnessProducts, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { tokenPx } from './hotspotCardChecks'

// The floating card lays out at its content's width, clamped by the card
// width token, for every hotspot of every product. The placement may dock
// the card on the harness stage (a side clear of the subject is the rule,
// and a large part can leave none), so the widths are measured on copies of
// the open card laid out under the overlay box at the floating card's own
// rule: content width up to the token, the clamp off, and a title
// lengthened past the token, which must lay out at exactly the token. The
// copies carry the card's own classes, so the stylesheet's rule is what
// lays them out, and the widths compare exactly, read from the resize
// observer's border box, the layout's own size before any transform or
// pixel snapping. Where the live card does float, its width answers the
// same number as its copy. The copy rules give the title and every bullet
// one line.

const products = await harnessProducts()

for (const product of products) {
  for (const hotspot of product.hotspots) {
    test(`card width ${product.slug}: the card of ${hotspot.title} lays out at its content width clamped by the token, one line per title and bullet`, async ({
      page,
      backendPath,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto(harnessPath(backendPath, product.slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, hotspot.title).click()
      await expect(cardHeadingOf(page, hotspot.title)).toBeVisible()
      await settledFrames(page)

      const widths = await markerOf(page, hotspot.title).evaluate(async (marker, title) => {
        const overlayBox = marker.parentElement?.parentElement
        const wrapper = document.querySelector('[data-testid="hotspot-card"]')
        if (overlayBox === null || overlayBox === undefined || wrapper === null) {
          throw new Error(`the open card of ${title} must sit in the page with its marker`)
        }
        const heading = wrapper.querySelector('h2')
        if (heading === null) {
          throw new Error('the open card must carry a title heading')
        }

        // The floating card's own layout rule, as the stylesheet writes it,
        // applied to copies of the open card whatever slot it sits in.
        const floatingCopy = (source: Element): HTMLElement => {
          const copy = source.cloneNode(true)
          if (!(copy instanceof HTMLElement)) {
            throw new Error('the card copy must be an element')
          }
          copy.style.position = 'absolute'
          copy.style.insetBlockStart = '0'
          copy.style.insetInlineStart = '0'
          copy.style.inlineSize = 'max-content'
          copy.style.maxInlineSize = 'var(--size-hotspot-card-max)'
          copy.style.visibility = 'hidden'
          copy.removeAttribute('data-testid')
          return copy
        }
        const card = floatingCopy(wrapper)
        const unclamped = floatingCopy(wrapper)
        unclamped.style.maxInlineSize = 'none'
        const lengthened = floatingCopy(wrapper)
        const lengthenedHeading = lengthened.querySelector('h2')
        if (lengthenedHeading === null) {
          throw new Error('the lengthened copy must carry the title heading')
        }
        lengthenedHeading.textContent = `${heading.textContent ?? ''} `.repeat(8).trim()
        for (const copy of [card, unclamped, lengthened]) {
          overlayBox.appendChild(copy)
        }

        const elements = [card, unclamped, lengthened]
        const sizes = await new Promise<number[]>((resolve) => {
          const observer = new ResizeObserver((entries) => {
            observer.disconnect()
            resolve(
              elements.map((element) => {
                const entry = entries.find((candidate) => candidate.target === element)
                const size = entry?.borderBoxSize[0]
                if (size === undefined) {
                  throw new Error('every observed copy must report a border box')
                }
                return size.inlineSize
              }),
            )
          })
          for (const element of elements) {
            observer.observe(element)
          }
        })
        // One line box per line: a range over an element's text answers one
        // rectangle per line it lays out on.
        const lines = [card.querySelector('h2'), ...card.querySelectorAll('li')].map((element) => {
          if (element === null) {
            throw new Error('the card copy must carry the title heading')
          }
          const range = document.createRange()
          range.selectNodeContents(element)
          return range.getClientRects().length
        })
        for (const copy of elements) {
          copy.remove()
        }
        const [atRule, content, clamped] = sizes
        if (atRule === undefined || content === undefined || clamped === undefined) {
          throw new Error('the observer must answer all three widths')
        }
        // The live card's own width when it floats: its slot element sits
        // in this same overlay box.
        const floating = overlayBox.contains(wrapper) ? wrapper.getBoundingClientRect().width : null
        return { atRule, content, clamped, lines, floating }
      }, hotspot.title)

      const maxPx = await tokenPx(page, '--size-hotspot-card-max')
      expect(widths.clamped, `a title past the token must lay out at the ${maxPx}px token`).toBe(
        maxPx,
      )
      expect(
        widths.atRule,
        `the card must lay out at its content width clamped by the ${maxPx}px token`,
      ).toBe(Math.min(widths.content, maxPx))
      if (widths.floating !== null) {
        expect(
          widths.floating,
          'the live floating card answers the same width as its copy at the rule',
        ).toBe(widths.atRule)
      }
      expect(widths.lines, 'the title and every bullet lay out on one line').toEqual(
        widths.lines.map(() => 1),
      )
    })
  }
}
