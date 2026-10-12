import { describe, expect, it } from 'vitest'
import { VaoCacheReadingError, vaoCacheEntriesOf } from './vaoCacheReading'

// The reading of the WebGL2 fallback's vertex array cache: its entry count
// on the WebGL2 backend, null on the WebGPU backend, and a named failure
// for every other shape, so a cache that moved can never read as no cache.

const webgl = (fields: object) => ({ isWebGLBackend: true, ...fields })

describe('vaoCacheEntriesOf', () => {
  it('counts the entries of the WebGL2 backend cache', () => {
    expect(vaoCacheEntriesOf(webgl({ vaoCache: { ':1:5': {}, ':2:7:9': {} } }))).toBe(2)
  })

  it('counts zero entries on an empty cache, never null', () => {
    expect(vaoCacheEntriesOf(webgl({ vaoCache: {} }))).toBe(0)
  })

  it('reads null for the WebGPU backend, which has no cache', () => {
    expect(vaoCacheEntriesOf({ isWebGPUBackend: true })).toBeNull()
  })

  it('fails by name for a WebGL2 backend whose cache is missing or not an object', () => {
    for (const fields of [{}, { vaoCache: null }, { vaoCache: 3 }, { vertexArrayCache: {} }]) {
      expect(() => vaoCacheEntriesOf(webgl(fields))).toThrow(VaoCacheReadingError)
    }
  })

  it('fails by name for a backend of neither kind and for no backend at all', () => {
    for (const backend of [{}, { vaoCache: {} }, null, undefined]) {
      expect(() => vaoCacheEntriesOf(backend)).toThrow(VaoCacheReadingError)
    }
  })
})
