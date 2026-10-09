import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type { FrameClock } from './FrameClock'
import { StageFrames } from './StageFrames'
import { RendererErrorBoundary } from './RendererErrorBoundary'
import { RendererRig } from './RendererRig'
import { RendererMemoryProbe } from './automation/RendererMemoryProbe'
import { StageCamera } from './camera/StageCamera'
import { ProductModelsProvider } from './product/ProductModelsProvider'
import { StageEnvironment } from './StageEnvironment'
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
  // Reports a frame that threw while no product owned the stage's frames.
  readonly onFrameFailure: (error: Error) => void
  // Reports that this canvas's renderer is retired: a present threw.
  readonly onRendererRetired: () => void
  // The scene content the stage shows: mounted after the rig, inside the
  // stage's frames, under one null-fallback Suspense boundary and the model
  // provider, so an async load never crosses the canvas and every model
  // decodes through the renderer's own decoders.
  readonly content?: ReactNode
}

// The Canvas subtree of a valid request: the error boundary R3F routes a
// failed factory through, the Canvas with the async renderer factory, and
// the in-canvas components that own the start-up identity checks, the
// renderer's settings, the renderer's memory probe, the frames and their
// failures, the camera, and the content. The boundary's report fails the
// stage, and the stage's one failed rule shows the alert, so the fallback
// itself is empty.
export function StageCanvas({
  clock,
  stageRenderer,
  onFirstFrame,
  onInitError,
  onFrameFailure,
  onRendererRetired,
  content,
}: StageCanvasProps) {
  return (
    <RendererErrorBoundary onError={onInitError} fallback={() => null}>
      <Canvas gl={stageRenderer.factory} frameloop={stageConfig.frameloop} dpr={stageConfig.dpr}>
        <RendererRig />
        <RendererMemoryProbe />
        <StageFrames
          clock={clock}
          onFirstFrame={onFirstFrame}
          onFrameFailure={onFrameFailure}
          onRendererRetired={onRendererRetired}
        >
          <StageCamera>
            <Suspense fallback={null}>
              <StageEnvironment />
              <ProductModelsProvider>{content}</ProductModelsProvider>
            </Suspense>
          </StageCamera>
        </StageFrames>
      </Canvas>
    </RendererErrorBoundary>
  )
}
