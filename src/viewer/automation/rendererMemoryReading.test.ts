import { describe, expect, it } from 'vitest'
import { rendererMemoryOf, type RendererInfoMemory } from './rendererMemoryReading'

const memory: RendererInfoMemory = {
  geometries: 26,
  textures: 28,
  texturesSize: 20_108_407,
  attributes: 87,
  attributesSize: 1_532_288,
  indexAttributes: 25,
  indexAttributesSize: 660_156,
}

describe('rendererMemoryOf', () => {
  it('carries every resource counter and its byte size, with the vertex array cache of the WebGL2 backend', () => {
    expect(rendererMemoryOf(memory, { isWebGLBackend: true, vaoCache: { ':1:2': {} } })).toEqual({
      geometries: 26,
      textures: 28,
      textureBytes: 20_108_407,
      attributes: 87,
      attributeBytes: 1_532_288,
      indexAttributes: 25,
      indexAttributeBytes: 660_156,
      vaoCache: 1,
    })
  })

  it('reads the vertex array cache as null on the WebGPU backend', () => {
    expect(rendererMemoryOf(memory, { isWebGPUBackend: true }).vaoCache).toBeNull()
  })
})
