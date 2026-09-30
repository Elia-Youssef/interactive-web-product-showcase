import { Canvas } from '@react-three/fiber'
import type { FrameClock } from './FrameClock'
import { FrameObserver } from './FrameObserver'
import { RendererAlert } from './RendererAlert'
import { RendererErrorBoundary } from './RendererErrorBoundary'
import { RendererRig } from './RendererRig'
import { initFailureReason } from '@lib/renderer/initFailure'
import type { StageRendererStart } from './rendererFactory'
import { stageConfig } from './config'

type StageCanvasProps = {
  readonly clock: FrameClock
  // The renderer start the stage's lifecycle hook memoized per request.
  readonly stageRenderer: StageRendererStart
  // Fires after the first frame actually rendered.
  readonly onFirstFrame: () => void
  // Reports a renderer that could not start on either backend.
  readonly onInitError: (error: Error) => void
}

// The Canvas subtree of a valid request: the error boundary R3F routes a
// failed factory through, the Canvas with the async renderer factory, and
// the in-canvas components that own the start-up identity checks, the
// renderer's settings and the frame signal.
export function StageCanvas({ clock, stageRenderer, onFirstFrame, onInitError }: StageCanvasProps) {
  return (
    <RendererErrorBoundary
      onError={onInitError}
      fallback={(error) => <RendererAlert reason={initFailureReason(error)} />}
    >
      <Canvas gl={stageRenderer.factory} frameloop={stageConfig.frameloop} dpr={stageConfig.dpr}>
        <RendererRig />
        <FrameObserver clock={clock} onFirstFrame={onFirstFrame} />
      </Canvas>
    </RendererErrorBoundary>
  )
}
