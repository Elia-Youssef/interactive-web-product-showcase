import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type { FrameClock } from './FrameClock'
import { FrameObserver } from './FrameObserver'
import type { PresentedFrames } from './PresentedFrames'
import { StageAlert } from './StageAlert'
import { RendererErrorBoundary } from './RendererErrorBoundary'
import { RendererRig } from './RendererRig'
import { StageCamera } from './camera/StageCamera'
import { ProductDecoderProvider } from './product/DecoderProvider'
import { StageEnvironment } from './StageEnvironment'
import { initFailureReason } from '@lib/renderer/initFailure'
import type { StageRendererStart } from './rendererFactory'
import { stageConfig } from './config'

type StageCanvasProps = {
  readonly clock: FrameClock
  // The stage's presented-frame channel, fed by this canvas's frame observer.
  readonly frames: PresentedFrames
  // The renderer start the stage's lifecycle hook memoized per request.
  readonly stageRenderer: StageRendererStart
  // Fires after the first frame actually rendered.
  readonly onFirstFrame: () => void
  // Reports a renderer that could not start on either backend.
  readonly onInitError: (error: Error) => void
  // The scene content the stage shows: mounted after the rig and the frame
  // observer, under one null-fallback Suspense boundary and the decoder
  // provider, so an async load never crosses the canvas and every loader
  // decodes through the renderer's own decoders.
  readonly content?: ReactNode
}

// The Canvas subtree of a valid request: the error boundary R3F routes a
// failed factory through, the Canvas with the async renderer factory, and
// the in-canvas components that own the start-up identity checks, the
// renderer's settings, the frame signal, the camera, and the content.
export function StageCanvas({
  clock,
  frames,
  stageRenderer,
  onFirstFrame,
  onInitError,
  content,
}: StageCanvasProps) {
  return (
    <RendererErrorBoundary
      onError={onInitError}
      fallback={(error) => <StageAlert reason={initFailureReason(error)} />}
    >
      <Canvas gl={stageRenderer.factory} frameloop={stageConfig.frameloop} dpr={stageConfig.dpr}>
        <RendererRig />
        <FrameObserver clock={clock} frames={frames} onFirstFrame={onFirstFrame} />
        <StageCamera>
          <Suspense fallback={null}>
            <StageEnvironment />
            <ProductDecoderProvider>{content}</ProductDecoderProvider>
          </Suspense>
        </StageCamera>
      </Canvas>
    </RendererErrorBoundary>
  )
}
