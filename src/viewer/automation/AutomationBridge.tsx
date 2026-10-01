import { useEffect } from 'react'
import { selectProductStatus, selectRendererStatus, useAppStoreApi } from '@store/index'
import type { FrameClock } from '../FrameClock'
import type { StageProbes } from './StageProbes'
import {
  createViewerAutomation,
  readViewerFinish,
  type ViewerCameraSource,
} from './viewerAutomation'

type AutomationBridgeProps = {
  readonly clock: FrameClock
  // The stage's probes, created with the stage this bridge serves: the look
  // getter reads the reader the product's look component registered.
  readonly probes: StageProbes
  // The live renderer's tone mapping, or null while there is no renderer.
  readonly getToneMapping: () => number | null
  // The live stage camera read, or null while no stage camera owns the
  // view. The stage hands the read of its camera slot down.
  readonly getCamera: ViewerCameraSource
}

// Installs window.__viewer for as long as the stage lives and removes it on
// unmount, on the failure paths included: the hook is the test contract of
// the whole stage, not only of its happy path. The stage owns the renderer
// reference and the camera read and hands the live reads down; every field
// is read from the store, the clock, the probes or the camera at access
// time, so there is no copy that can go stale, and a second stage cannot
// silently take the contract over.
export function AutomationBridge({
  clock,
  probes,
  getToneMapping,
  getCamera,
}: AutomationBridgeProps) {
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
      getLook: () => probes.read('look'),
      getCamera,
      getFinish: readViewerFinish,
    })
    window.__viewer = automation
    return () => {
      // The identity guard keeps StrictMode's cleanup from removing a hook a
      // later owner installed.
      if (window.__viewer === automation) {
        delete window.__viewer
      }
    }
  }, [clock, probes, getToneMapping, getCamera, store])

  return null
}
