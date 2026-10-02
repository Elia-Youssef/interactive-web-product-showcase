import type { Product } from '@lib/product'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { HotspotAnchor } from './HotspotAnchor'
import { useHotspotFlow } from './useHotspotFlow'
import { useHotspotSelectionEffects } from './useHotspotSelectionEffects'

// The DOM side of the hotspots: one anchor per manifest hotspot, in manifest
// order, rendered in the stage overlay while the store's product status is
// ready for this product. The store wiring lives in the flow hook beside
// this file; the anchor's own structure is the presentational
// HotspotAnchor. The selection's Escape and clear-on-leave effects live in
// their own hook, so no side of the feature moves the camera except the
// store's camera request channel.
export function HotspotMarkers({ product }: { readonly product: Product }) {
  const overlay = useStageOverlay()
  const flow = useHotspotFlow(product)
  useHotspotSelectionEffects({
    presented: flow.presented,
    slug: product.slug,
    selected: flow.selected,
    close: flow.close,
  })

  if (!flow.presented) {
    return null
  }

  return (
    <>
      {product.hotspots.map((hotspot) => (
        <HotspotAnchor
          key={hotspot.id}
          overlay={overlay}
          hotspot={hotspot}
          selected={flow.selected === hotspot.id}
          onToggle={() => flow.toggle(hotspot.id)}
          onClose={flow.close}
        />
      ))}
    </>
  )
}
