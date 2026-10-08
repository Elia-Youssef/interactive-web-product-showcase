import { useEffect } from 'react'
import { useStageElement } from '@viewer/stageElementContext'
import { listenForCanvasPress } from './listenForCanvasPress'

export function useHotspotOutsideDismiss(active: boolean, dismiss: () => void): void {
  const surface = useStageElement()
  useEffect(() => {
    if (!active) return
    const element = surface.current
    if (element === null) {
      throw new Error('an open hotspot must have its stage element')
    }
    return listenForCanvasPress(element, dismiss)
  }, [active, dismiss, surface])
}
