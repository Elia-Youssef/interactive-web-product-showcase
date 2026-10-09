// The storage facts of one product model: how its positions are stored and
// how its animation translation outputs are. The validate step holds the
// file against the storage the pipeline writes, down to the grid of the
// stored values: the position facts come from the read-back document (the
// accessor's component type, normalized flag and stored integers), the
// translation facts from the file's own glTF JSON and binary chunk, where
// the meshopt writer records the filter per compressed buffer view and
// stores each key as mantissas over a shared exponent.
import { GLB_BUFFER, type Document, type GLTF, type NodeIO } from '@gltf-transform/core'
import { MeshoptDecoder } from 'meshoptimizer'
import { SHORT_COMPONENT_TYPE } from './componentTypes.ts'
import { keyBitsOfMantissa } from './storageGrid.ts'
import { KEY_FILTER_BITS } from './settings.ts'

// How one mesh's POSITION is stored, by the mesh's own name: the
// accessor's component type and normalized flag, and how many of its stored
// integers sit off the pipeline's quantize grid (counted for the normalized
// Int16 storage the grid is stated in, zero for any other storage, whose
// type is the finding).
export type PositionStorageFact = {
  readonly meshName: string
  readonly componentType: number
  readonly normalized: boolean
  readonly offGridValues: number
}

// How one translation channel's output is stored: through the EXPONENTIAL
// filter with the key bits its largest stored mantissa needs, or through
// another filter (null when the buffer view is not meshopt-compressed).
export type KeyStorage =
  | { readonly kind: 'exponential'; readonly keyBits: number }
  | { readonly kind: 'otherFilter'; readonly filter: string | null }

// One translation channel's output storage, with the animation and the node
// the channel drives, so a report names both.
export type TranslationOutputFact = {
  readonly animationName: string
  readonly targetName: string
  readonly storage: KeyStorage
}

export type StorageFacts = {
  readonly positions: readonly PositionStorageFact[]
  readonly translationOutputs: readonly TranslationOutputFact[]
}

// The position facts of a document, in mesh order, with every stored
// integer of a normalized Int16 position held against the grid.
export function readPositionStorage(
  doc: Document,
  grid: ReadonlySet<number>,
): PositionStorageFact[] {
  const facts: PositionStorageFact[] = []
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (position === null) {
        continue
      }
      const componentType = position.getComponentType()
      const normalized = position.getNormalized()
      const stored = position.getArray() ?? []
      facts.push({
        meshName: mesh.getName(),
        componentType,
        normalized,
        offGridValues:
          componentType === SHORT_COMPONENT_TYPE && normalized
            ? Array.from(stored).filter((value) => !grid.has(Math.abs(value))).length
            : 0,
      })
    }
  }
  return facts
}

// The position facts of an in-memory document, declared the way the meshopt
// writer stores them: one normalized Int16 position per mesh, on the grid.
// An in-memory document stands for an optimized file, and its accessors
// hold plain floats the compression has not touched, so this is the
// declaration the fixtures stand in for, not a read; the rule fixtures keep
// their positions float so their cameras and bounds read authored numbers.
export function declaredPositionStorage(doc: Document): PositionStorageFact[] {
  return doc
    .getRoot()
    .listMeshes()
    .filter((mesh) =>
      mesh.listPrimitives().some((primitive) => primitive.getAttribute('POSITION') !== null),
    )
    .map((mesh) => ({
      meshName: mesh.getName(),
      componentType: SHORT_COMPONENT_TYPE,
      normalized: true,
      offGridValues: 0,
    }))
}

// The translation output facts of a written model file: the output of every
// channel whose target path is translation, with the storage its buffer
// view carries. The channel's own target path selects the output, the same
// rule the in-memory declaration below follows: the meshopt writer stores
// rotation outputs through another filter on purpose, so an output is a
// translation output only by the channel that reads it. The JSON and the
// binary chunk come from the library's own GLB reader; an EXPONENTIAL view
// is decompressed without its filter, so the stored mantissas read as they
// were written.
export async function readTranslationOutputs(
  io: NodeIO,
  modelPath: string,
): Promise<TranslationOutputFact[]> {
  await MeshoptDecoder.ready
  const { json, resources } = await io.readAsJSON(modelPath)
  const facts: TranslationOutputFact[] = []
  for (const animation of json.animations ?? []) {
    for (const channel of animation.channels) {
      if (channel.target.path !== 'translation') {
        continue
      }
      const sampler = animation.samplers[channel.sampler]
      const accessor = json.accessors?.[sampler?.output ?? -1]
      if (accessor === undefined) {
        throw new Error(`a translation channel of ${modelPath} names no output accessor`)
      }
      facts.push({
        animationName: animation.name ?? '',
        targetName: nodeNameOf(json, channel.target.node),
        storage: keyStorageOf(json, resources, accessor),
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

// The meshopt compression of one buffer view, as the extension records it.
type MeshoptView = {
  readonly buffer: number
  readonly byteOffset: number
  readonly byteLength: number
  readonly byteStride: number
  readonly count: number
  readonly mode: string
  readonly filter: string
}

// The meshopt compression a buffer view carries, or null when it carries
// none. A malformed extension fails loudly: the file read back whole before
// these facts are taken, so a field the decoder needed is never missing.
function meshoptViewOf(bufferView: GLTF.IBufferView | undefined): MeshoptView | null {
  const extension: unknown = bufferView?.extensions?.['EXT_meshopt_compression']
  if (typeof extension !== 'object' || extension === null) {
    return null
  }
  const field = (name: string): unknown => Reflect.get(extension, name)
  const numberField = (name: string, fallback?: number): number => {
    const value = field(name) ?? fallback
    if (typeof value !== 'number') {
      throw new Error(`an EXT_meshopt_compression buffer view carries no number ${name}`)
    }
    return value
  }
  const mode = field('mode')
  const filter = field('filter') ?? 'NONE'
  if (typeof mode !== 'string' || typeof filter !== 'string') {
    throw new Error('an EXT_meshopt_compression buffer view carries no mode or filter name')
  }
  return {
    buffer: numberField('buffer'),
    byteOffset: numberField('byteOffset', 0),
    byteLength: numberField('byteLength'),
    byteStride: numberField('byteStride'),
    count: numberField('count'),
    mode,
    filter,
  }
}

// The storage of one translation output accessor: its view's filter, and
// for the EXPONENTIAL filter the key bits its largest stored mantissa
// needs. The view is decompressed with no filter, so each 32-bit word reads
// as written: a signed 8-bit exponent over a signed 24-bit mantissa.
function keyStorageOf(
  json: GLTF.IGLTF,
  resources: Readonly<Record<string, Uint8Array>>,
  accessor: GLTF.IAccessor,
): KeyStorage {
  const view = meshoptViewOf(json.bufferViews?.[accessor.bufferView ?? -1])
  if (view === null || view.filter !== 'EXPONENTIAL') {
    return { kind: 'otherFilter', filter: view?.filter ?? null }
  }
  const data = resources[json.buffers?.[view.buffer]?.uri ?? GLB_BUFFER]
  if (data === undefined) {
    throw new Error(`the compressed data of buffer ${view.buffer} is not in the file`)
  }
  const raw = new Uint8Array(view.count * view.byteStride)
  MeshoptDecoder.decodeGltfBuffer(
    raw,
    view.count,
    view.byteStride,
    data.subarray(view.byteOffset, view.byteOffset + view.byteLength),
    view.mode,
    'NONE',
  )
  const words = new Int32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
  const components = accessor.type === 'VEC3' ? 3 : 1
  const first = (accessor.byteOffset ?? 0) / 4
  const stride = view.byteStride / 4
  let largest = 0
  for (let element = 0; element < accessor.count; element += 1) {
    for (let component = 0; component < components; component += 1) {
      const word = words[first + element * stride + component] ?? 0
      largest = Math.max(largest, Math.abs((word << 8) >> 8))
    }
  }
  return { kind: 'exponential', keyBits: keyBitsOfMantissa(largest) }
}

// The translation output facts of an in-memory document: one per channel
// whose target path is translation, the same selection the file reader
// makes, each declared with the storage the meshopt writer gives it (the
// EXPONENTIAL filter at the pipeline's key bits). The rule fixtures
// represent optimized files, and the storage is a property of the
// compression the file went through, which an in-memory document has not:
// this is the declaration the fixtures stand in for, not a read.
export function declaredTranslationOutputs(doc: Document): TranslationOutputFact[] {
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
          storage: { kind: 'exponential', keyBits: KEY_FILTER_BITS } as const,
        })),
    )
}
