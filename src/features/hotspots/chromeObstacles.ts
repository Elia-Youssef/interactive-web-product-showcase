import type { StageRect } from '@lib/hotspots/cardPlacement'

// The stage chrome as obstacles for the floating card: every child of the
// chrome element that lays out with an area, as a box in stage pixels. The
// chrome element is laid over the stage box exactly (the composition's
// contract), so a child's box relative to it is its box on the stage. The
// chrome paints above the overlay, so a card under any of these boxes would
// lose its own controls under the chrome.
export function readChromeObstacles(chrome: Element | null): readonly StageRect[] {
  if (chrome === null) {
    return []
  }
  const origin = chrome.getBoundingClientRect()
  const boxes: StageRect[] = []
  for (const child of chrome.children) {
    const box = child.getBoundingClientRect()
    if (box.width > 0 && box.height > 0) {
      boxes.push({
        left: box.left - origin.left,
        top: box.top - origin.top,
        right: box.right - origin.left,
        bottom: box.bottom - origin.top,
      })
    }
  }
  return boxes
}
