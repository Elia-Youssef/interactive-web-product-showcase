import { WebGPURenderer } from 'three/webgpu'
import type { BackendRequestResult } from '../../src/lib/renderer/request'
import type { createStageRenderer } from '../../src/viewer/rendererFactory'

declare global {
  interface Window {
    __failStageInit?: () => void
    __stageInitCalls?: number
  }
}

export const stageInitFaultMessage = 'controlled renderer initialization failure'

// Gate the renderer's actual init call, so navigation can cover the stage
// before the real async factory rejects into its error boundary.
export function createWithInitFault(
  component: typeof createStageRenderer,
  request: BackendRequestResult,
) {
  const failed = new Promise<void>((resolve) => {
    window.__failStageInit = resolve
  })
  WebGPURenderer.prototype.init = async () => {
    window.__stageInitCalls = (window.__stageInitCalls ?? 0) + 1
    await failed
    throw new Error(stageInitFaultMessage)
  }
  return component(request)
}
