import { useEffect } from 'react'
import { selectProductStatus, selectRendererStatus, useAppStoreApi } from '@store/index'
import type { FrameClock } from '../FrameClock'
import { createViewerAutomation } from './viewerAutomation'

type AutomationBridgeProps = {
  readonly clock: FrameClock
  // The live renderer's tone mapping, or null while there is no renderer.
  readonly getToneMapping: () => number | null
}

// Installs window.__viewer for as long as the stage lives and removes it on
// unmount, on the failure paths included: the hook is the test contract of
// the whole stage, not only of its happy path. The stage owns the renderer
// reference and hands the live reads down; there is no module-level
// singleton, and a second stage cannot silently take the contract over.
export function AutomationBridge({ clock, getToneMapping }: AutomationBridgeProps) {
  const store = useAppStoreApi()

  useEffect(() => {
    if (window.__viewer !== undefined) {
      throw new Error('window.__viewer is already held by another stage')
    }
    const automation = createViewerAutomation({
      getStatus: () => selectRendererStatus(store.getState()),
      getProductStatus: () => selectProductStatus(store.getState()),
      renderedFrames: () => clock.renderedFrames,
      getToneMapping,
    })
    window.__viewer = automation
    return () => {
      // The identity guard keeps StrictMode's cleanup from removing a hook a
      // later owner installed.
      if (window.__viewer === automation) {
        delete window.__viewer
      }
    }
  }, [clock, getToneMapping, store])

  return null
}
