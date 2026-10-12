import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import type { Product } from '@lib/product'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import type { HotspotOrigin } from '@lib/hotspots/flow'
import { readCardLayout } from '@lib/hotspots/cardLayout'
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
  origin: HotspotOrigin | null,
): { readonly presenter: HotspotCardPresenter; readonly slot: CardSlot | null } {
  const presenter = useMemo(
    () =>
      new HotspotCardPresenter(
        overlay,
        product.hotspots.map((hotspot) => hotspot.id),
        { layout: readDocumentCardLayout, obstacles: () => overlay.geometry.read() },
      ),
    [overlay, product],
  )

  useEffect(() => overlay.onPass(() => presenter.present(), 'presenter'), [overlay, presenter])

  useEffect(() => overlay.geometry.subscribe(() => presenter.chromeChanged()), [overlay, presenter])

  useLayoutEffect(() => {
    presenter.show(selected === null || origin === null ? null : { hotspotId: selected, origin })
    overlay.card.present()
    return () => {
      presenter.show(null)
      overlay.card.present()
    }
  }, [overlay, presenter, selected, origin])

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
