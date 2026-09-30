import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAppStore, selectProductStatus } from '@store/index'
import { AutomationBridge } from './automation/AutomationBridge'
import { FrameClock } from './FrameClock'
import { ModelWatch } from './ModelWatch'
import { StageModelContext } from './stageModelContext'
import { StageSettle } from './StageSettle'
import { StageSettleContext } from './stageSettleContext'
import { DevHud } from './hud/DevHud'
import { StageAlert } from './StageAlert'
import { StageCanvas } from './StageCanvas'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import styles from './Stage.module.css'

export type StageProps = {
  // The scene content the stage shows inside its Canvas, after the rig and
  // the frame observer. It renders under the stage's Suspense boundary and
  // reports into the stage's model watch through the stage model context.
  readonly content?: ReactNode
}

// The stage: it owns its frame clock, its model watch and its scene settle,
// one per mount, and reads the backend request once. It wires the renderer
// lifecycle to the store, mounts the automation hook for its whole lifetime
// (failure paths included), mounts the dev HUD in dev builds, and shows
// either the canvas or the typed error state of an invalid request, plus
// the product's alert when the product failed. The alerts are DOM elements
// outside the Canvas. It owns no landmark and fills the box its container
// gives it; the app owns the page frame.
export function Stage({ content }: StageProps = {}) {
  const [clock] = useState(() => new FrameClock())
  const [modelWatch] = useState(() => new ModelWatch())
  const [settle] = useState(() => new StageSettle(clock))
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
        content={content}
      />
    )

  return (
    <div className={styles.stage}>
      <StageSettleContext.Provider value={settle}>
        <StageModelContext.Provider value={modelWatch}>
          <AutomationBridge clock={clock} modelWatch={modelWatch} getToneMapping={getToneMapping} />
          {canvas}
          {productStatus.kind === 'failed' && (
            <StageAlert
              testid="product-alert"
              reason={`${productStatus.slug}: ${productStatus.reason}`}
            />
          )}
          {import.meta.env.DEV && <DevHud clock={clock} />}
        </StageModelContext.Provider>
      </StageSettleContext.Provider>
    </div>
  )
}
