import type { Locator } from '@playwright/test'
import { expect } from './fixtures'

// Whole element bounds must fit the viewport and every clipping ancestor.
// The caller completes the owned scroll before asking for this geometry.
export async function expectCardPartsInsideBand(parts: readonly Locator[]): Promise<void> {
  for (const part of parts) {
    const count = await part.count()
    expect(count, 'every named card part is mounted').toBeGreaterThan(0)
    for (let index = 0; index < count; index++) {
      await expect(part.nth(index), 'the card part remains readable').toBeVisible()
      expect(
        await part.nth(index).evaluate(insideVisibleBand),
        'the whole card part fits its visible band',
      ).toBe(true)
    }
  }
}

function insideVisibleBand(element: Element): boolean {
  const box = element.getBoundingClientRect()
  let left = 0
  let top = 0
  let right = window.innerWidth
  let bottom = window.innerHeight
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    // The document's scrollport is the viewport, already included above.
    if (parent === document.scrollingElement) continue
    const style = getComputedStyle(parent)
    const port = parent.getBoundingClientRect()
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, port.left + parent.clientLeft)
      right = Math.min(right, port.left + parent.clientLeft + parent.clientWidth)
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, port.top + parent.clientTop)
      bottom = Math.min(bottom, port.top + parent.clientTop + parent.clientHeight)
    }
  }
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.left >= left &&
    box.top >= top &&
    box.right <= right &&
    box.bottom <= bottom
  )
}
