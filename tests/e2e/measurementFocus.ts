import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Start native Tab navigation immediately before the marker, rather than
// at an unrelated control. The empty, absolutely positioned focus point
// takes no layout space and is removed before any placement is measured.
export async function focusVisibly(page: Page, marker: Locator): Promise<void> {
  const scroll = await page.evaluateHandle(() =>
    [...document.querySelectorAll('*')].map((element) => ({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    })),
  )
  const start = await marker.evaluateHandle((element) => {
    const point = document.createElement('span')
    point.tabIndex = -1
    point.style.position = 'absolute'
    point.style.inset = '0'
    element.before(point)
    point.focus({ preventScroll: true })
    return point
  })
  try {
    await page.keyboard.press('Tab')
  } finally {
    await start.evaluate((point) => point.remove())
    await start.dispose()
  }
  const visible = await marker.evaluate((element) => element.matches(':focus-visible'))
  expect(visible, 'the marker must take keyboard focus with its ring drawn').toBe(true)
  const changed = await scroll.evaluate((positions) =>
    positions
      .filter(({ element, left, top }) => element.scrollLeft !== left || element.scrollTop !== top)
      .map(({ element, left, top }) => ({
        element: element.tagName,
        before: { left, top },
        after: { left: element.scrollLeft, top: element.scrollTop },
      })),
  )
  await scroll.dispose()
  expect(changed, 'obtaining keyboard focus must preserve every scroll position').toEqual([])
}
