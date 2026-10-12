import { useEffect } from 'react'
import { useStagePointerGestures } from '@viewer/stagePointerGesturesContext'

export function useHotspotOutsideDismiss(active: boolean, dismiss: () => void): void {
  const gestures = useStagePointerGestures()
  useEffect(() => {
    if (active) return gestures.consumePressWith(dismiss)
  }, [active, dismiss, gestures])
}
