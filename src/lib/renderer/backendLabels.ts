import type { RendererBackend } from './backend'

// The readable label of each rendering backend, defined once. The dev HUD
// and the e2e assertions both show and check these words, so the page and
// its tests cannot drift apart.
export const backendLabels: Readonly<Record<RendererBackend, string>> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
}
