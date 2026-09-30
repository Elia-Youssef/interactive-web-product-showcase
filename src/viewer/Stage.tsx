import { useState } from 'react'
import { AutomationBridge } from './automation/AutomationBridge'
import { FrameClock } from './FrameClock'
import { DevHud } from './hud/DevHud'
import { RendererAlert } from './RendererAlert'
import { StageCanvas } from './StageCanvas'
import { backendRequestFromLocation } from './backendRequest'
import { useRendererLifecycle } from './useRendererLifecycle'
import styles from './Stage.module.css'

// The stage: it owns its frame clock, one per mount, and reads the backend
// request once. It wires the renderer lifecycle to the store, mounts the
// automation hook for its whole lifetime (failure paths included), mounts
// the dev HUD in dev builds, and shows either the canvas or the typed error
// state of an invalid request. It owns no landmark and fills the box its
// container gives it; the app owns the page frame.
export function Stage() {
  const [clock] = useState(() => new FrameClock())
  const [request] = useState(backendRequestFromLocation)
  const { stageRenderer, handleFirstFrame, handleInitError, getToneMapping } =
    useRendererLifecycle(request)

  const content =
    request.kind === 'invalid' ? (
      <RendererAlert reason={request.reason} />
    ) : (
      <StageCanvas
        clock={clock}
        stageRenderer={stageRenderer}
        onFirstFrame={handleFirstFrame}
        onInitError={handleInitError}
      />
    )

  return (
    <div className={styles.stage}>
      <AutomationBridge clock={clock} getToneMapping={getToneMapping} />
      {content}
      {import.meta.env.DEV && <DevHud clock={clock} />}
    </div>
  )
}
