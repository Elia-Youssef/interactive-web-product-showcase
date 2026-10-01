import { useState } from 'react'
import type { ReactNode } from 'react'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { useAppStore, selectProductStatus } from '@store/index'
import { AutomationBridge } from './automation/AutomationBridge'
import { createCameraSourceSlot } from './camera/cameraSource'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import { StageHoldsContext } from './stageHoldsContext'
import { StageSettleContext } from './stageSettleContext'
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
}

// The stage: it owns its frame clock, its scene settle and the holds on its
// content's loaded resources, one each per mount, and reads the backend
// request once. It wires the renderer lifecycle to the store, mounts the
// automation hook for its whole lifetime (failure paths included), mounts
// the dev HUD in dev builds, and shows either the canvas or the typed error
// state of an invalid request, plus the product's alert when the product
// failed. The alerts are DOM elements outside the Canvas. It owns no
// landmark and fills the box its container gives it; the app owns the page
// frame.
export function Stage({ content }: StageProps = {}) {
  const [clock] = useState(() => new FrameClock())
  const [settle] = useState(() => new StageSettle(clock))
  // A dropped hold is released once the effect flush that dropped it has
  // ended: React runs a flush's cleanups and setups in one synchronous call,
  // so the microtask after it is the first moment nothing can take the hold
  // again.
  const [holds] = useState(() => new ResourceHolds<object>((callback) => queueMicrotask(callback)))
  // The slot the stage camera registers its live read into, for the
  // automation hook. One per stage, like the clock and the settle.
  const [cameraSlot] = useState(createCameraSourceSlot)
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
        stageRenderer={stageRenderer}
        onFirstFrame={handleFirstFrame}
        onInitError={handleInitError}
        cameraSlot={cameraSlot}
        content={content}
      />
    )

  return (
    <div className={styles.stage}>
      <StageSettleContext.Provider value={settle}>
        <StageHoldsContext.Provider value={holds}>
          <AutomationBridge
            clock={clock}
            getToneMapping={getToneMapping}
            getCamera={() => cameraSlot.read()}
          />
          {canvas}
          {productStatus.kind === 'failed' && (
            <StageAlert
              testid="product-alert"
              reason={`${productStatus.slug}: ${productStatus.reason}`}
            />
          )}
          {import.meta.env.DEV && <DevHud clock={clock} />}
        </StageHoldsContext.Provider>
      </StageSettleContext.Provider>
    </div>
  )
}
