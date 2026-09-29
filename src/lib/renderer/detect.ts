import type { RendererBackend } from './backend'

// A live renderer as backend detection sees it, typed structurally because
// lib/ cannot import three. The backend is an object; the flags it may carry
// are read with `in` at run time, so no three property needs naming here.
export type BackendCarrier = {
  readonly backend?: object
}

// Reads the backend a live renderer actually runs on. Detection reads the
// renderer, never the URL, so what the app reports cannot drift from what
// really renders. A renderer without a recognizable backend, or claiming
// both at once, is a broken setup and fails loudly instead of guessing.
export function detectRendererBackend(renderer: BackendCarrier): RendererBackend {
  const backend = renderer.backend
  if (backend === undefined) {
    throw new Error(
      'The renderer carries no recognizable backend: expected isWebGPUBackend or isWebGLBackend',
    )
  }
  const isWebGPU = 'isWebGPUBackend' in backend && backend.isWebGPUBackend === true
  const isWebGL = 'isWebGLBackend' in backend && backend.isWebGLBackend === true
  if (isWebGPU && isWebGL) {
    throw new Error(
      'The renderer claims both the WebGPU and the WebGL2 backend, which is malformed',
    )
  }
  if (isWebGPU) {
    return 'webgpu'
  }
  if (isWebGL) {
    return 'webgl2'
  }
  throw new Error(
    'The renderer carries no recognizable backend: expected isWebGPUBackend or isWebGLBackend',
  )
}
