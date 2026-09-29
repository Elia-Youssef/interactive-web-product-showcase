import { useCallback, useEffect, useMemo } from 'react'
import { initFailureReason } from '@lib/renderer/initFailure'
import type { BackendRequestResult } from '@lib/renderer/request'
import { useAppStore } from '@store/index'
import { createStageRenderer } from './rendererFactory'
import type { StageRendererStart } from './rendererFactory'

// The wiring from the renderer lifecycle to the store's renderer events: an
// invalid request reaches the store as failed, the ready event waits for the
// first frame the stage's observer saw, an init failure arrives through the
// error boundary, and an unmount resets and releases the renderer. Nothing
// here throws: the factory owns every check that can fail, and its verdict
// reaches this hook as a resolved or rejected promise.
export function useRendererLifecycle(request: BackendRequestResult): {
  stageRenderer: StageRendererStart
  handleFirstFrame: () => void
  handleInitError: (error: Error) => void
  getToneMapping: () => number | null
} {
  const rendererReady = useAppStore((state) => state.rendererReady)
  const rendererFailed = useAppStore((state) => state.rendererFailed)
  const rendererReset = useAppStore((state) => state.rendererReset)

  // One renderer start per request, never rebuilt per render: the factory
  // runs once per canvas and leaves its verdict where the first-frame path
  // and the live reads find it.
  const stageRenderer = useMemo(() => createStageRenderer(request), [request])

  // A fresh mount starts from a clean status, and an unmount releases the
  // renderer reference with it.
  useEffect(() => {
    if (request.kind === 'invalid') {
      rendererFailed(request.reason)
    }
    return () => {
      rendererReset()
    }
  }, [request, rendererFailed, rendererReset])

  const handleFirstFrame = useCallback(() => {
    const started = stageRenderer.started()
    if (started === null) {
      // A frame cannot render before the factory resolved, so this fires
      // only if that invariant breaks. It reports through the store instead
      // of throwing, because this callback runs inside the render loop.
      rendererFailed(
        initFailureReason(new Error('the first frame rendered before start-up finished')),
      )
      return
    }
    rendererReady(started.backend)
  }, [stageRenderer, rendererReady, rendererFailed])

  const handleInitError = useCallback(
    (error: Error) => {
      rendererFailed(initFailureReason(error))
    },
    [rendererFailed],
  )

  const getToneMapping = useCallback(
    () => stageRenderer.started()?.renderer.toneMapping ?? null,
    [stageRenderer],
  )

  return { stageRenderer, handleFirstFrame, handleInitError, getToneMapping }
}
