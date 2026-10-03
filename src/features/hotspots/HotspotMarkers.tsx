import type { Product } from '@lib/product'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { HotspotAnchor } from './HotspotAnchor'
import { HotspotCard } from './HotspotCard'
import { useHotspotCard } from './useHotspotCard'
import { useHotspotFlow } from './useHotspotFlow'
import { useHotspotSelectionEffects } from './useHotspotSelectionEffects'

export type HotspotMarkersProps = {
  readonly product: Product
  // The layout's dock: the element the open card renders into when its
  // presenter docks it. Null until the composition's dock has mounted.
  readonly dock: HTMLElement | null
  // The stage chrome painted over the overlay, laid over the stage box
  // exactly: the floating card keeps clear of its children's boxes. Null
  // where the stage has no chrome, or until it has mounted.
  readonly chrome: Element | null
}

// The DOM side of the hotspots: one anchor per manifest hotspot, in manifest
// order, rendered in the stage overlay while the store's product status is
// ready for this product, and the open card in the slot its presenter
// chose. The store wiring lives in the flow hook beside this file; the
// anchor's own structure is the presentational HotspotAnchor. The
// selection's Escape and clear-on-leave effects live in their own hook, so
// no side of the feature moves the camera except the store's camera request
// channel.
export function HotspotMarkers({ product, dock, chrome }: HotspotMarkersProps) {
  const overlay = useStageOverlay()
  const flow = useHotspotFlow(product)
  useHotspotSelectionEffects({
    presented: flow.presented,
    slug: product.slug,
    selected: flow.selected,
    close: flow.close,
  })
  const card = useHotspotCard(overlay, product, flow.presented ? flow.selected : null, chrome)

  if (!flow.presented) {
    return null
  }
  const { slot } = card
  const open = slot === null ? null : hotspotOf(product, slot.hotspotId)

  return (
    <>
      {product.hotspots.map((hotspot) => (
        <HotspotAnchor
          key={hotspot.id}
          overlay={overlay}
          hotspot={hotspot}
          selected={flow.selected === hotspot.id}
          onToggle={() => flow.toggle(hotspot.id)}
        />
      ))}
      {slot !== null && open !== null && (
        <HotspotCard
          key={open.id}
          hotspot={open}
          slot={slot}
          overlay={overlay}
          presenter={card.presenter}
          dock={dock}
          onClose={flow.close}
        />
      )}
    </>
  )
}

// The manifest hotspot a card slot names. The presenter only ever names a
// hotspot of this product, so a miss is a composition error and fails
// loudly instead of rendering no card for an open selection.
function hotspotOf(product: Product, hotspotId: string): Product['hotspots'][number] {
  const hotspot = product.hotspots.find((candidate) => candidate.id === hotspotId)
  if (hotspot === undefined) {
    throw new Error(`the open card names '${hotspotId}', which ${product.slug} has no hotspot for`)
  }
  return hotspot
}
