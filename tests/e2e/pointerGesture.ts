import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { canvasDrivePoint } from './canvasDrivePoint'
import { cardCloseButtonOf } from './hotspotViews'
import { scrollPositions } from './stageKeys'

// Record actual focus events through the native gesture, so an eventual
// return cannot hide an earlier competing handoff to the stage target.
export async function driveCardPointer(page: Page, gesture: 'click' | 'drag'): Promise<string> {
  const close = cardCloseButtonOf(page)
  await close.focus()
  const beforeScroll = await scrollPositions(page)
  const point = await canvasDrivePoint(page)
  await page.evaluate(() => {
    const root = document.documentElement
    root.dataset.pointerStageFocus = ''
    document.addEventListener('focusin', (event) => {
      if (event.target instanceof Element && event.target.hasAttribute('data-stage-keys')) {
        root.dataset.pointerStageFocus += 's'
      }
    })
  })
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await expect(close, 'pending input has not chosen a focus handoff').toBeFocused()
  if (gesture === 'drag') {
    await page.mouse.move(point.x + 10, point.y)
    await page.mouse.move(point.x, point.y)
  }
  await page.mouse.up()
  const handoffs = await page.evaluate(() => document.documentElement.dataset.pointerStageFocus)
  expect(handoffs, 'the classified gesture commits exactly its own focus outcome').toBe(
    gesture === 'drag' ? 's' : '',
  )
  return beforeScroll
}
