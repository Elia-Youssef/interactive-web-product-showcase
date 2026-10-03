import { useState } from 'react'
import type { ReactNode } from 'react'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { useAppStore, selectProductStatus, selectRendererStatus } from '@store/index'
import { StageProbes } from './automation/StageProbes'
import { AutomationBridge } from './automation/AutomationBridge'
import { StageProbesContext } from './automation/stageProbesContext'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import { StageHoldsContext } from './stageHoldsContext'
import { StageSettleContext } from './stageSettleContext'
import { DevHud } from './hud/DevHud'
import { productFailureMessage } from './product/failureMessage'
import { StageAlert } from './StageAlert'
import { StageCanvas } from './StageCanvas'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import styles from './Stage.module.css'

export type StageProps = {
  // The scene content the stage shows inside its Canvas, after the rig and
  // inside the stage's frames. It renders under the stage's Suspense
  // boundary, settles its mutations through the stage's settle chain, runs
  // its frame callbacks through the stage's frame path and holds the
  // resources it loads through the stage's holds.
  readonly content?: ReactNode
}

// The stage: it owns its frame clock, its scene settle and the holds on its
// content's loaded resources, one each per mount, and reads the backend
// request once. It wires the renderer lifecycle to the store, mounts the
// automation hook for its whole lifetime (failure paths included), mounts
// the dev HUD in dev builds, and mounts the canvas. A failed stage, whatever
// failed it, mounts no content and shows the renderer alert; a failed
// product shows the product alert. The alerts are DOM elements outside the
// Canvas. It owns no landmark and fills the box its container gives it; the
// app owns the page frame.
export function Stage({ content }: StageProps = {}) {
  const [clock] = useState(() => new FrameClock())
  const [settle] = useState(() => new StageSettle(clock))
  // A dropped hold is released once the effect flush that dropped it has
  // ended: React runs a flush's cleanups and setups in one synchronous call,
  // so the microtask after it is the first moment nothing can take the hold
  // again.
  const [holds] = useState(() => new ResourceHolds<object>((callback) => queueMicrotask(callback)))
  // The stage's probes, one per mount like the settle and the holds: the
  // in-canvas components that own live objects register their readers here,
  // and the automation bridge reads them at access time.
  const [probes] = useState(() => new StageProbes())
  const [request] = useState(backendRequestFromLocation)
  const productStatus = useAppStore(selectProductStatus)
  const rendererStatus = useAppStore(selectRendererStatus)
  const { stageRenderer, handleFirstFrame, handleInitError, handleFrameFailure, getToneMapping } =
    useRendererLifecycle(request)
  // The one rule of a failed stage, whatever failed it (an invalid request,
  // a renderer that cannot start, a frame that failed under no product): it
  // mounts no content and shows the renderer alert.
  const stageFailed = rendererStatus.kind === 'failed'

  const canvas = request.kind === 'valid' && (
    <StageCanvas
      clock={clock}
      stageRenderer={stageRenderer}
      onFirstFrame={handleFirstFrame}
      onInitError={handleInitError}
      onFrameFailure={handleFrameFailure}
      content={stageFailed ? null : content}
    />
  )

  return (
    <div className={styles.stage}>
      <StageSettleContext.Provider value={settle}>
        <StageProbesContext.Provider value={probes}>
          <StageHoldsContext.Provider value={holds}>
            <AutomationBridge clock={clock} probes={probes} getToneMapping={getToneMapping} />
            {canvas}
            {stageFailed && <StageAlert reason={rendererStatus.reason} />}
            {productStatus.kind === 'failed' && (
              <StageAlert
                testid="product-alert"
                reason={`${productStatus.slug}: ${productFailureMessage(productStatus.failure)}`}
              />
            )}
            {import.meta.env.DEV && <DevHud clock={clock} />}
          </StageHoldsContext.Provider>
        </StageProbesContext.Provider>
      </StageSettleContext.Provider>
    </div>
  )
}
