import { useEffect, useRef } from 'react'
import { selectRendererStatus, useAppStore } from '@store/index'
import type { ShownProductLife } from './useProductSwitch'

// The page owns the shown life even when a failed stage removes Product.
// Observe each pending life independently of the canvas, including lives
// navigated to after failure. Product and stage outcomes remain separate.
export function useShownStageFailure({
  life,
  outcome,
  onStageFailed,
}: Pick<ShownProductLife, 'life' | 'outcome' | 'onStageFailed'>): void {
  const status = useAppStore(selectRendererStatus)
  const reportedLife = useRef<number | null>(null)
  useEffect(() => {
    if (status.kind === 'failed' && outcome === 'pending' && reportedLife.current !== life) {
      reportedLife.current = life
      onStageFailed()
    }
  }, [status.kind, life, outcome, onStageFailed])
}
