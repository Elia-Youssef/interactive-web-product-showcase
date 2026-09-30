// The rendering backends the viewer can run on, in preference order. The
// type is derived from the list so detection code and UI copy can never
// drift apart.
export const rendererBackends = ['webgpu', 'webgl2'] as const

export type RendererBackend = (typeof rendererBackends)[number]
