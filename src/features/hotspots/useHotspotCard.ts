import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import type { Product } from '@lib/product'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import { readCardLayout } from './cardLayout'
import { readChromeObstacles } from './chromeObstacles'
import { HotspotCardPresenter, type CardSlot } from './HotspotCardPresenter'

// The open card's presenter for one product's markers on one stage, wired
// to the stage overlay's passes, to the selection and to the stage chrome's
// size, and its published slot. The selection reaches the presenter in a
// layout effect, so a card that opens is decided and placed before the
// browser paints; the slot is external state, so its change commits before
// the paint too.
export function useHotspotCard(
  overlay: StageOverlay,
  product: Product,
  selected: string | null,
  chrome: Element | null,
): { readonly presenter: HotspotCardPresenter; readonly slot: CardSlot | null } {
  const presenter = useMemo(
    () =>
      new HotspotCardPresenter(
        overlay,
        product.hotspots.map((hotspot) => hotspot.id),
        { layout: readDocumentCardLayout, obstacles: () => readChromeObstacles(chrome) },
      ),
    [overlay, product, chrome],
  )

  useEffect(() => overlay.onPass(() => presenter.present()), [overlay, presenter])

  // The chrome's corners change size with their content (a readout, the
  // controls); each change is a change of the obstacles.
  useEffect(() => {
    if (chrome === null) {
      return undefined
    }
    const observer = new ResizeObserver(() => presenter.chromeChanged())
    for (const child of chrome.children) {
      observer.observe(child)
    }
    return () => observer.disconnect()
  }, [chrome, presenter])

  useLayoutEffect(() => {
    presenter.show(selected)
    return () => presenter.show(null)
  }, [presenter, selected])

  const slot = useSyncExternalStore(presenter.subscribe, presenter.snapshot)
  // A slot published for an earlier selection never renders: the layout
  // effect above hands the presenter the new one before the paint.
  return { presenter, slot: slot !== null && slot.hotspotId === selected ? slot : null }
}

// The card layout of the page: the tokens live on the document root, and
// the breakpoints switch the dock policy there.
function readDocumentCardLayout() {
  return readCardLayout(getComputedStyle(document.documentElement))
}
