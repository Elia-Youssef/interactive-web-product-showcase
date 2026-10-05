import { useCallback } from 'react'
import type { Product } from '@lib/product'
import { selectProductStatus, selectSelectedHotspot, useAppStore } from '@store/index'

// The selection flow of one product's hotspots, read from and dispatched
// through the store. A marker press and a close are one store action each:
// the store reads what the flow needs (the close-up set, the explode
// target) at the event and writes the selection and the camera request it
// owes in one update. Nothing here moves the camera any other way.

export type HotspotFlow = {
  // Whether this product is the one presented, the state the markers and
  // the card render in.
  readonly presented: boolean
  // The id of this product's selected hotspot, or null while idle.
  readonly selected: string | null
  readonly press: (hotspotId: string) => void
  readonly close: () => void
}

export function useHotspotFlow(product: Product): HotspotFlow {
  const slug = product.slug
  const productStatus = useAppStore(selectProductStatus)
  const selected = useAppStore((state) => selectSelectedHotspot(state, slug))
  const hotspotPressed = useAppStore((state) => state.hotspotPressed)
  const hotspotClosed = useAppStore((state) => state.hotspotClosed)

  const presented = productStatus.kind === 'ready' && productStatus.slug === slug
  const press = useCallback(
    (hotspotId: string) => hotspotPressed(slug, hotspotId),
    [hotspotPressed, slug],
  )
  const close = useCallback(() => hotspotClosed(slug), [hotspotClosed, slug])

  return { presented, selected, press, close }
}
