import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { useAppStore, selectProductStatus, selectRendererStatus } from '@store/index'
import { StageProbes } from './automation/StageProbes'
import { AutomationBridge } from './automation/AutomationBridge'
import { StageProbesContext } from './automation/stageProbesContext'
import { FrameClock } from './FrameClock'
import { StageHoldsContext } from './stageHoldsContext'
import { DevHud } from './hud/DevHud'
import { productFailureMessage } from './product/failureMessage'
import { StageAlert } from './StageAlert'
import { StageCanvas } from './StageCanvas'
import { StageLife } from './StageLife'
import { StageElementContext } from './stageElementContext'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import { useStageCanvasLife } from './useStageCanvasLife'
import styles from './Stage.module.css'

export type StageProps = {
  // The scene content the stage shows inside its Canvas, after the rig and
  // inside the stage's frames. It renders under the stage's Suspense
  // boundary, settles its mutations through the canvas's settle chain, runs
  // its frame callbacks through the stage's frame path and holds the
  // resources it loads through the stage's holds.
  readonly content?: ReactNode
  // The DOM content the stage shows over its canvas, in the canvas's own
  // box and inside the stage's providers: the overlay content registers its
  // elements with the overlay channel of the canvas life it shows over, and
  // the canvas content writes their placements through the same channel.
  // The overlay's empty area passes pointer events through to the canvas.
  readonly overlay?: ReactNode
}

// The stage: it owns its frame clock, the holds on its content's loaded
// resources and its probes, one each per mount, and reads the backend
// request once. Inside, it mounts one canvas life at a time, keyed by the
// life's epoch: the canvas, and the overlay channel and overlay content that
// belong to that canvas, so a renderer retired by a present that threw is
// replaced by a fresh canvas, with a fresh overlay over it, when new content
// arrives. It wires the renderer lifecycle to the store, mounts the
// automation hook for its whole lifetime (failure paths included) and the
// dev HUD in dev builds. A failed stage, whatever failed it, mounts no
// content and shows the renderer alert; a failed product shows the product
// alert. The alerts and the overlay are DOM elements outside the Canvas. It
// owns no landmark and fills the box its container gives it; the app owns
// the page frame.
export function Stage({ content, overlay }: StageProps = {}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [clock] = useState(() => new FrameClock())
  // A dropped hold is released once the effect flush that dropped it has
  // ended: React runs a flush's cleanups and setups in one synchronous call,
  // so the microtask after it is the first moment nothing can take the hold
  // again.
  const [holds] = useState(() => new ResourceHolds<object>((callback) => queueMicrotask(callback)))
  // The stage's probes, one per mount like the clock and the holds: the
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
  const canvasLife = useStageCanvasLife(productStatus.kind === 'loading', stageFailed)

  const canvas = request.kind === 'valid' && (
    <StageCanvas
      clock={clock}
      stageRenderer={stageRenderer}
      onFirstFrame={handleFirstFrame}
      onInitError={handleInitError}
      onFrameFailure={handleFrameFailure}
      onRendererRetired={canvasLife.retire}
      content={stageFailed ? null : content}
    />
  )

  return (
    <StageElementContext.Provider value={elementRef}>
      <div className={styles.stage} ref={elementRef}>
        <StageProbesContext.Provider value={probes}>
          <StageHoldsContext.Provider value={holds}>
            <AutomationBridge clock={clock} probes={probes} getToneMapping={getToneMapping} />
            <StageLife key={canvasLife.epoch} canvas={canvas} overlay={overlay} />
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
      </div>
    </StageElementContext.Provider>
  )
}
