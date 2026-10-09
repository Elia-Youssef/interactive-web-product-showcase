// The storage facts of one product model: how its positions are stored and
// what filter its animation translation outputs carry. The validate step
// holds the file against the storage the pipeline writes: the position
// facts come from the read-back document (the accessor's own component type
// and normalized flag), the translation filters from the file's own glTF
// JSON, where the meshopt writer records the filter per compressed buffer
// view.
import type { Document, GLTF, NodeIO } from '@gltf-transform/core'

// How one mesh's POSITION is stored, by the mesh's own name.
export type PositionStorageFact = {
  readonly meshName: string
  readonly componentType: number
  readonly normalized: boolean
}

// What filter one translation channel's output is stored through: the
// animation and the node the channel drives, so a report names both.
export type TranslationFilterFact = {
  readonly animationName: string
  readonly targetName: string
  readonly filter: string | null
}

export type StorageFacts = {
  readonly positions: readonly PositionStorageFact[]
  readonly translationFilters: readonly TranslationFilterFact[]
}

// The position facts of a document, in mesh order: the component type and
// normalized flag each primitive's POSITION accessor carries.
export function readPositionStorage(doc: Document): PositionStorageFact[] {
  const facts: PositionStorageFact[] = []
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (position === null) {
        continue
      }
      facts.push({
        meshName: mesh.getName(),
        componentType: position.getComponentType(),
        normalized: position.getNormalized(),
      })
    }
  }
  return facts
}

// The position facts of an in-memory document, declared the way the meshopt
// writer stores them: one normalized Int16 position per mesh. An
// in-memory document stands for an optimized file, and its accessors hold
// plain floats the compression has not touched, so this is the declaration
// the fixtures stand in for, not a read; the rule fixtures keep their
// positions float so their cameras and bounds read authored numbers.
export function declaredPositionStorage(doc: Document): PositionStorageFact[] {
  return doc
    .getRoot()
    .listMeshes()
    .filter((mesh) =>
      mesh.listPrimitives().some((primitive) => primitive.getAttribute('POSITION') !== null),
    )
    .map((mesh) => ({ meshName: mesh.getName(), componentType: 5122, normalized: true }))
}

// The translation filter facts of a written model file: the output of every
// channel whose target path is translation, with the meshopt filter its
// buffer view carries (null when the buffer view is not meshopt-compressed).
// The channel's own target path selects the output, the same rule the
// in-memory declaration below follows: the meshopt writer stores rotation
// outputs through another filter on purpose, so an output is a translation
// output only by the channel that reads it. The JSON comes from the
// library's own GLB reader, no meshopt decode involved.
export async function readTranslationFilters(
  io: NodeIO,
  modelPath: string,
): Promise<TranslationFilterFact[]> {
  const { json } = await io.readAsJSON(modelPath)
  const facts: TranslationFilterFact[] = []
  for (const animation of json.animations ?? []) {
    for (const channel of animation.channels) {
      if (channel.target.path !== 'translation') {
        continue
      }
      const sampler = animation.samplers[channel.sampler]
      const accessor = json.accessors?.[sampler?.output ?? -1]
      const bufferView = json.bufferViews?.[accessor?.bufferView ?? -1]
      facts.push({
        animationName: animation.name ?? '',
        targetName: nodeNameOf(json, channel.target.node),
        filter: meshoptFilterOf(bufferView),
      })
    }
  }
  return facts
}

// The name of a channel's target node, or its index when it carries none.
function nodeNameOf(json: GLTF.IGLTF, node: number | undefined): string {
  if (node === undefined) {
    return 'no node'
  }
  return json.nodes?.[node]?.name ?? `node ${node}`
}

// The meshopt filter a buffer view's compression extension names, or null
// when the view carries no meshopt compression.
function meshoptFilterOf(bufferView: GLTF.IBufferView | undefined): string | null {
  const extension = bufferView?.extensions?.['EXT_meshopt_compression']
  if (typeof extension !== 'object' || extension === null || !('filter' in extension)) {
    return null
  }
  return typeof extension.filter === 'string' ? extension.filter : null
}

// The translation filter facts of an in-memory document: one per channel
// whose target path is translation, the same selection the file reader
// makes, each declared with the filter the meshopt writer stores it
// through. The rule fixtures represent optimized files, and the filter is a
// property of the compression the file went through, which an in-memory
// document has not: this is the declaration the fixtures stand in for, not
// a read.
export function declaredTranslationFilters(doc: Document): TranslationFilterFact[] {
  return doc
    .getRoot()
    .listAnimations()
    .flatMap((animation) =>
      animation
        .listChannels()
        .filter((channel) => channel.getTargetPath() === 'translation')
        .map((channel) => ({
          animationName: animation.getName(),
          targetName: channel.getTargetNode()?.getName() ?? 'no node',
          filter: 'EXPONENTIAL',
        })),
    )
}
