import type { RendererBackend } from '@lib/renderer/backend'
import { detectRendererBackend } from '@lib/renderer/detect'
import { StageRendererStartError } from '@lib/renderer/initFailure'
import type { BackendRequestResult } from '@lib/renderer/request'
import { asError } from '@lib/errors'
import { WebGPURenderer } from 'three/webgpu'
import { stageConfig } from './config'
import { assertStageRenderer } from './stageIdentity'

// The canvas R3F hands a gl factory, narrowed to what the factory needs.
// R3F's own type allows an OffscreenCanvas the WebGPURenderer cannot take,
// so the factory checks for an HTMLCanvasElement and fails loudly instead of
// casting.
export type FactoryCanvasProps = {
  readonly canvas: HTMLCanvasElement | EventTarget
}

// What a started stage renderer is: the live renderer and the backend it
// actually came up on, detected in the factory, so nothing after start-up
// can find the backend missing.
export type StartedStageRenderer = {
  readonly renderer: WebGPURenderer
  readonly backend: RendererBackend
}

// The renderer start of one stage mount: the async gl factory for R3F's
// Canvas, and the verdict the factory leaves behind. R3F awaits the factory
// before any render or configure, so every start-up check that can fail runs
// inside it: the canvas check before init, then the renderer type and backend
// detection after init. A failure rejects the factory promise, which R3F routes
// through the error boundary into the store's failed status. The request
// decides forceWebGL only; the real backend is read from the live renderer
// after init, never from the URL.
export type StageRendererStart = {
  readonly factory: (props: FactoryCanvasProps) => Promise<WebGPURenderer>
  // The renderer the factory started, or null while start-up runs.
  readonly started: () => StartedStageRenderer | null
}

export function createStageRenderer(request: BackendRequestResult): StageRendererStart {
  let started: StartedStageRenderer | null = null

  const factory = async ({ canvas }: FactoryCanvasProps) => {
    if (request.kind !== 'valid') {
      // The stage renders no canvas for an invalid request, so the factory
      // cannot be invoked; fail loudly if that invariant ever breaks.
      throw new Error('The stage renderer factory was invoked for an invalid request')
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('The stage renderer needs an HTMLCanvasElement, which R3F always passes')
    }
    const renderer = new WebGPURenderer({
      canvas,
      alpha: stageConfig.alpha,
      antialias: stageConfig.antialias,
      powerPreference: stageConfig.powerPreference,
      forceWebGL: request.request.kind === 'forced-webgl2',
    })
    // The factory owns the renderer until all startup checks pass and R3F
    // takes it. Rollback must finish before the failure is reported, and a
    // rollback that fails with its own error travels with the start failure
    // instead of being dropped.
    try {
      await renderer.init()
      assertStageRenderer(renderer)
      const startedRenderer: StartedStageRenderer = {
        renderer,
        backend: detectRendererBackend(renderer),
      }
      started = startedRenderer
      return renderer
    } catch (error) {
      const startup = asError(error)
      try {
        await renderer.dispose()
      } catch (rollbackFailure) {
        // A disposal after a failed init can reject with the init error
        // itself: the same failure is not a second one. Identity is read on
        // the values raised, before normalization, so a non-Error value
        // raised by both counts once too. Any other rollback rejection is a
        // failure of its own and is reported with the start failure, the
        // start failure first.
        if (rollbackFailure !== error) {
          throw new StageRendererStartError(startup, asError(rollbackFailure))
        }
      }
      throw startup
    }
  }

  return { factory, started: () => started }
}
