import { useEffect } from 'react'
import { useAppStore } from '@store/index'
import { useEscapeLayer } from '@ui/index'

// The selection's effects outside the overlay, for one product's hotspot
// flow. Escape closes the open card through the escape owner: the card is
// a layer while its selection is open, so the key reaches it only when no
// higher layer (the collection index) is open, wherever focus rests. And
// leaving the product clears its selection, when the product stops being
// presented (a remount, a product switch) and when the feature unmounts,
// so returning never reopens a stale card. The clear on leave dispatches
// no camera request: the next product presents its own home view.
export function useHotspotSelectionEffects({
  presented,
  slug,
  selected,
  close,
}: {
  readonly presented: boolean
  readonly slug: string
  readonly selected: string | null
  readonly close: () => void
}): void {
  const hotspotCleared = useAppStore((state) => state.hotspotCleared)

  useEscapeLayer(selected !== null, close)

  useEffect(() => {
    if (!presented) {
      return
    }
    return () => {
      hotspotCleared(slug)
    }
  }, [presented, slug, hotspotCleared])
}
