import { useLayoutEffect } from 'react'
import type { StageGeometry } from '@viewer/overlay/StageGeometry'

// Slot resizes invalidate both the geometry snapshot and the canvas pass:
// controls can wrap while the camera is at rest, without a camera request.
export function useChromeGeometry(geometry: StageGeometry, chrome: Element | null): void {
  useLayoutEffect(() => {
    geometry.setChrome(chrome)
    if (chrome === null) {
      return undefined
    }
    const observer = new ResizeObserver(() => geometry.changed())
    observer.observe(chrome)
    for (const child of chrome.children) {
      observer.observe(child)
    }
    return () => {
      observer.disconnect()
      geometry.setChrome(null)
    }
  }, [geometry, chrome])
}
