import type { Product } from '@lib/product'
import { selectProductStatus, selectSelectedHotspot, useAppStore } from '@store/index'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { Marker } from '@ui/index'
import { overlayKey } from './hotspotKeys'

// The DOM side of the hotspots: one marker per manifest hotspot, in manifest
// order, rendered in the stage overlay while the store's product status is
// ready for this product. The stage's overlay channel owns each marker's
// placement, so this side never positions anything itself: it mounts the
// elements under the feature's keys, names each marker with its hotspot's
// title, and hands presses to the store's hotspot slice. The canvas side of
// the feature, mounted beside the same product, writes the placements.
export function HotspotMarkers({ product }: { readonly product: Product }) {
  const overlay = useStageOverlay()
  const productStatus = useAppStore(selectProductStatus)
  const selected = useAppStore((state) => selectSelectedHotspot(state, product.slug))
  const hotspotToggled = useAppStore((state) => state.hotspotToggled)

  if (productStatus.kind !== 'ready' || productStatus.slug !== product.slug) {
    return null
  }

  return (
    <>
      {product.hotspots.map((hotspot) => (
        <Marker
          key={hotspot.id}
          ref={(element) => {
            // React 19 takes a ref cleanup in place of the null call: the
            // release is the mount's own, so a stale one would fail loudly.
            if (element === null) {
              return undefined
            }
            return overlay.mount(overlayKey(hotspot.id), element)
          }}
          label={hotspot.title}
          active={selected === hotspot.id}
          onClick={() => hotspotToggled(product.slug, hotspot.id)}
        />
      ))}
    </>
  )
}
