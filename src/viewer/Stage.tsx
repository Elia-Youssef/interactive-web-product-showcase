import { useState } from 'react'
import type { ReactNode } from 'react'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { useAppStore, selectProductStatus } from '@store/index'
import { StageProbes } from './automation/StageProbes'
import { AutomationBridge } from './automation/AutomationBridge'
import { StageProbesContext } from './automation/stageProbesContext'
import { FrameClock } from './FrameClock'
import { PresentedFrames } from './PresentedFrames'
import { StageSettle } from './StageSettle'
import { StageHoldsContext } from './stageHoldsContext'
import { StageFramesContext } from './stageFramesContext'
import { StageSettleContext } from './stageSettleContext'
import { StageOverlay } from './overlay/StageOverlay'
import { StageOverlayContext } from './overlay/stageOverlayContext'
import { DevHud } from './hud/DevHud'
import { StageAlert } from './StageAlert'
import { StageCanvas } from './StageCanvas'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import styles from './Stage.module.css'

export type StageProps = {
  // The scene content the stage shows inside its Canvas, after the rig and
  // the frame observer. It renders under the stage's Suspense boundary,
  // settles its mutations through the stage's settle chain and holds the
  // resources it loads through the stage's holds.
  readonly content?: ReactNode
  // The DOM content the stage shows over its canvas, in the canvas's own
  // box and inside the stage's providers: the overlay content registers its
  // elements with the stage's overlay channel, and the canvas content writes
  // their placements through the same channel. The overlay's empty area
  // passes pointer events through to the canvas.
  readonly overlay?: ReactNode
}

// The stage: it owns its frame clock, its scene settle, the holds on its
// content's loaded resources, its presented-frame channel and its overlay
// channel, one each per mount, and reads the backend request once. It wires
// the renderer lifecycle to the store, mounts the automation hook for its
// whole lifetime (failure paths included), mounts the dev HUD in dev builds,
// and shows either the canvas, the overlay above it, or the typed error
// state of an invalid request, plus the product's alert when the product
// failed. The alerts and the overlay are DOM elements outside the Canvas. It
// owns no landmark and fills the box its container gives it; the app owns
// the page frame.
export function Stage({ content, overlay }: StageProps = {}) {
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
  // The stage's presented-frame channel and its overlay channel, one per
  // mount like the rest of the stage's per-mount state.
  const [frames] = useState(() => new PresentedFrames())
  const [overlayChannel] = useState(() => new StageOverlay())
  const [request] = useState(backendRequestFromLocation)
  const productStatus = useAppStore(selectProductStatus)
  const { stageRenderer, handleFirstFrame, handleInitError, getToneMapping } =
    useRendererLifecycle(request)

  const canvas =
    request.kind === 'invalid' ? (
      <StageAlert reason={request.reason} />
    ) : (
      <StageCanvas
        clock={clock}
        frames={frames}
        stageRenderer={stageRenderer}
        onFirstFrame={handleFirstFrame}
        onInitError={handleInitError}
        content={content}
      />
    )

  return (
    <div className={styles.stage}>
      <StageSettleContext.Provider value={settle}>
        <StageProbesContext.Provider value={probes}>
          <StageHoldsContext.Provider value={holds}>
            <StageFramesContext.Provider value={frames}>
              <StageOverlayContext.Provider value={overlayChannel}>
                <AutomationBridge clock={clock} probes={probes} getToneMapping={getToneMapping} />
                {canvas}
                {overlay !== undefined && <div className={styles.overlay}>{overlay}</div>}
                {productStatus.kind === 'failed' && (
                  <StageAlert
                    testid="product-alert"
                    reason={`${productStatus.slug}: ${productStatus.reason}`}
                  />
                )}
                {import.meta.env.DEV && <DevHud clock={clock} />}
              </StageOverlayContext.Provider>
            </StageFramesContext.Provider>
          </StageHoldsContext.Provider>
        </StageProbesContext.Provider>
      </StageSettleContext.Provider>
    </div>
  )
}
