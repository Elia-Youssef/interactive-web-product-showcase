import { useCallback, useMemo } from 'react'
import type { Product } from '@lib/product'
import { closeUpHotspotIds } from '@lib/product'
import {
  selectHotspotStatus,
  selectProductStatus,
  selectSelectedHotspot,
  selectionAfterToggle,
  useAppStore,
} from '@store/index'
import { hotspotCameraRequest } from './hotspotFlow.logic'

// The selection flow of one product's hotspots, read from and dispatched
// through the store. Pressing a marker toggles the selection and dispatches
// the camera request the change owes, computed by the flow from the
// close-up set the ready status's rig summary carries; closing clears the
// selection and dispatches what closing owes. Nothing here moves the camera
// any other way.

export type HotspotFlow = {
  // Whether this product is the one presented, the state the markers and
  // the card render in.
  readonly presented: boolean
  // The id of this product's selected hotspot, or null while idle.
  readonly selected: string | null
  readonly toggle: (hotspotId: string) => void
  readonly close: () => void
}

export function useHotspotFlow(product: Product): HotspotFlow {
  const productStatus = useAppStore(selectProductStatus)
  const hotspotStatus = useAppStore(selectHotspotStatus)
  const hotspotToggled = useAppStore((state) => state.hotspotToggled)
  const hotspotCleared = useAppStore((state) => state.hotspotCleared)
  const cameraRequest = useAppStore((state) => state.cameraRequest)

  const presented = productStatus.kind === 'ready' && productStatus.slug === product.slug
  const selected = selectSelectedHotspot({ hotspotStatus }, product.slug)
  // The close-up set of the presented product's rig. While the status is
  // not ready for this product there is no rig and no selection UI, so the
  // empty set is only ever read where no dispatch can follow it.
  const closeUps = useMemo(() => {
    if (productStatus.kind !== 'ready' || productStatus.slug !== product.slug) {
      return new Set<string>()
    }
    return closeUpHotspotIds(productStatus.rig)
  }, [productStatus, product.slug])

  // The camera request the selection change from before to after owes,
  // dispatched through the store's camera request channel.
  const dispatchOwed = useCallback(
    (before: string | null, after: string | null) => {
      const owed = hotspotCameraRequest(before, after, closeUps)
      if (owed !== null) {
        cameraRequest(owed)
      }
    },
    [closeUps, cameraRequest],
  )

  const toggle = useCallback(
    (hotspotId: string) => {
      hotspotToggled(product.slug, hotspotId)
      dispatchOwed(selected, selectionAfterToggle(hotspotStatus, product.slug, hotspotId))
    },
    [product.slug, hotspotToggled, selected, hotspotStatus, dispatchOwed],
  )

  const close = useCallback(() => {
    if (selected === null) {
      return
    }
    hotspotCleared(product.slug)
    dispatchOwed(selected, null)
  }, [selected, product.slug, hotspotCleared, dispatchOwed])

  return { presented, selected, toggle, close }
}
