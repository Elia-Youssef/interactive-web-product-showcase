import { useEffect } from 'react'
import { selectRendererStatus, useAppStore } from '@store/index'
import type { ShownProductLife } from './useProductSwitch'

// The page owns the shown life even when a failed stage removes Product.
// Observe each pending life independently of the canvas, including lives
// navigated to after failure. Product and stage outcomes remain separate.
// The report carries no once guard of its own: the switch ends a shown
// life at most once, and a life that has ended is never pending again,
// so a report the effect replays changes nothing.
export function useShownStageFailure({
  outcome,
  onStageFailed,
}: Pick<ShownProductLife, 'outcome' | 'onStageFailed'>): void {
  const status = useAppStore(selectRendererStatus)
  useEffect(() => {
    if (status.kind === 'failed' && outcome === 'pending') {
      onStageFailed()
    }
  }, [status.kind, outcome, onStageFailed])
}
