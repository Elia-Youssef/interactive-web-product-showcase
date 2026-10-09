import type { ViewerRendererMemory } from './viewerAutomation'
import { vaoCacheEntriesOf } from './vaoCacheReading'

// The renderer's own memory counters the reading carries: the ones its
// shared resource code counts as each resource is created and destroyed,
// on both backends alike. The geometries, their attributes and index
// attributes, and the textures, each with its byte size. The counters the
// renderer's caches drive on their own schedule (programs, uniform buffers,
// render targets, and the total that sums them) are left out: they follow
// the pipeline cache, not the resources a product owns.
export type RendererInfoMemory = {
  readonly geometries: number
  readonly textures: number
  readonly texturesSize: number
  readonly attributes: number
  readonly attributesSize: number
  readonly indexAttributes: number
  readonly indexAttributesSize: number
}

// One reading of the live renderer's memory: its counters, plus the entries
// of the WebGL2 fallback's vertex array cache behind them.
export function rendererMemoryOf(
  memory: RendererInfoMemory,
  backend: unknown,
): ViewerRendererMemory {
  return {
    geometries: memory.geometries,
    textures: memory.textures,
    textureBytes: memory.texturesSize,
    attributes: memory.attributes,
    attributeBytes: memory.attributesSize,
    indexAttributes: memory.indexAttributes,
    indexAttributeBytes: memory.indexAttributesSize,
    vaoCache: vaoCacheEntriesOf(backend),
  }
}
