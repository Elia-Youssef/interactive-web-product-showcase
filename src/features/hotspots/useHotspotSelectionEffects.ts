import { useEffect } from 'react'
import { useAppStore } from '@store/index'

// The selection's effects outside the overlay, for one product's hotspot
// flow. Escape closes the open card: one keydown listener on the document,
// registered only while the product holds a selection and released when the
// selection clears or the feature unmounts, so Escape reaches the store
// through nothing while no card is open. And leaving the product clears its
// selection, when the product stops being presented (a remount, a product
// switch) and when the feature unmounts, so returning never reopens a stale
// card. The clear on leave dispatches no camera request: the next product
// presents its own home view.
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

  useEffect(() => {
    if (selected === null) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selected, close])

  useEffect(() => {
    if (!presented) {
      return
    }
    return () => {
      hotspotCleared(slug)
    }
  }, [presented, slug, hotspotCleared])
}
