import type { StageRect } from './markerBox'

type GeometryElement = {
  readonly getBoundingClientRect: () => {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
    readonly width: number
    readonly height: number
  }
}

export type ChromeGeometryRoot = GeometryElement & {
  readonly children: Iterable<GeometryElement>
}

// Chrome and overlay share the stage origin. Reading every laid-out slot,
// including noninteractive labels, gives every placement and browser proof
// the same obstacles without guessing which controls a slot contains.
export function readChromeObstacles(chrome: ChromeGeometryRoot | null): readonly StageRect[] {
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

// Keep-out contact is excluded too: no painted ring pixel may share the
// edge of a chrome surface.
export function rectsMeet(a: StageRect, b: StageRect): boolean {
  return rectsMeetBounds(a.left, a.top, a.right, a.bottom, b)
}

// The numeric form keeps marker checks allocation-free on the frame path.
export function rectsMeetBounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
  obstacle: StageRect,
): boolean {
  return (
    left <= obstacle.right &&
    obstacle.left <= right &&
    top <= obstacle.bottom &&
    obstacle.top <= bottom
  )
}
