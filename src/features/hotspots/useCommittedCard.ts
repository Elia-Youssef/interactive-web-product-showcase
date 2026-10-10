import { useCallback, useLayoutEffect } from 'react'
import type { StageOverlay } from '@viewer/overlay/StageOverlay'
import { readCardGeometry, type CardHost } from '@viewer/overlay/CommittedCard'
import { bringCardIntoView } from './bringCardIntoView'

export function useCommittedCard(overlay: StageOverlay, selected: string, slot: CardHost) {
  // A native commit changes only the overlay. It acknowledges the current
  // scene geometry without scheduling another 3D presentation.
  useLayoutEffect(() => overlay.card.present())
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) return undefined
      if (slot !== 'floating') bringCardIntoView(element)
      const releaseCard = overlay.card.mount(selected, slot, () => readCardGeometry(element))
      overlay.card.present()
      return () => {
        releaseCard()
        overlay.card.present()
      }
    },
    [overlay, selected, slot],
  )
}
