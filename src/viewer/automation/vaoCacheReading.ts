// The size of the renderer's vertex array cache, or null on the backend
// that has none. The WebGL2 fallback caches one vertex array object per
// attribute list a draw used, the one resource class its renderer counters
// do not count, so the cache's entry count is the exact reading of what
// the fallback holds behind them. The WebGPU backend has no such cache.
//
// The reading branches on the backend's own kind, never on the cache's
// presence: a WebGL2 backend whose cache is not where the reading expects
// it (a three release that moves it) fails loudly, so the reading can never
// turn into a quiet null that pins nothing.

export class VaoCacheReadingError extends Error {
  override name = 'VaoCacheReadingError'
}

// The size of the backend's vertex array cache in entries: a count on the
// WebGL2 fallback, null on WebGPU, and a VaoCacheReadingError for a WebGL2
// backend without the cache or for a backend of neither kind.
export function vaoCacheEntriesOf(backend: unknown): number | null {
  if (typeof backend !== 'object' || backend === null) {
    throw new VaoCacheReadingError('the vertex array cache reading needs a renderer backend')
  }
  if (Reflect.get(backend, 'isWebGPUBackend') === true) {
    return null
  }
  if (Reflect.get(backend, 'isWebGLBackend') !== true) {
    throw new VaoCacheReadingError('the renderer backend is neither the WebGPU nor the WebGL2 one')
  }
  const cache: unknown = Reflect.get(backend, 'vaoCache')
  if (typeof cache !== 'object' || cache === null) {
    throw new VaoCacheReadingError(
      'the WebGL2 backend carries no vertex array cache where the reading expects it (backend.vaoCache)',
    )
  }
  return Object.keys(cache).length
}
