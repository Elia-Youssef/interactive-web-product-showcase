import type { Locator } from '@playwright/test'

// Reachability checks need the whole element exposed, through whichever
// ancestors scroll. A nearest-edge scroll can leave a fractional edge
// clipped when the browser rounds its scroll offset to whole CSS pixels.
// Centering asks for room on both sides, without changing the visibility
// assertion or assuming that the panel rather than the document scrolls.
export async function scrollToReveal(element: Locator): Promise<void> {
  await element.evaluate((target) => target.scrollIntoView({ block: 'center', inline: 'nearest' }))
}
