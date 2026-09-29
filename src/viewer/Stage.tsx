import { useState, type ReactNode } from 'react'
import { useAppStore, selectProductStatus } from '@store/index'
import { AutomationBridge } from './automation/AutomationBridge'
import { FrameClock } from './FrameClock'
import { DevHud } from './hud/DevHud'
import { StageAlert } from './StageAlert'
import { StageCanvas } from './StageCanvas'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import styles from './Stage.module.css'

type StageProps = {
  // The scene content rendered inside the stage's Canvas. The stage starts
  // empty: the composition that mounts it decides what it draws.
  readonly content?: ReactNode
}

// The stage: it owns its frame clock, one per mount, and reads the backend
// request once. It wires the renderer lifecycle to the store, mounts the
// automation hook for its whole lifetime (failure paths included), mounts
// the dev HUD in dev builds, and shows either the canvas or the typed error
// state of an invalid request, plus the product's alert when the product
// failed. The alerts are DOM elements outside the Canvas; the canvas itself
// holds no landmark. The stage fills the box its container gives it; the
// app owns the page frame.
export function Stage({ content }: StageProps) {
  const [clock] = useState(() => new FrameClock())
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
      <AutomationBridge clock={clock} getToneMapping={getToneMapping} />
      {canvas}
      {productStatus.kind === 'failed' && (
        <StageAlert
          testid="product-alert"
          reason={`${productStatus.slug}: ${productStatus.reason}`}
        />
      )}
      {import.meta.env.DEV && <DevHud clock={clock} />}
    </div>
  )
}
