// The storage facts of one product model: how its positions are stored and
// what filter its animation translation outputs carry. The home-fit rule's
// allowance is stated in what the pipeline's storage can move, so the
// validate step holds the file against that storage: the position facts
// come from the read-back document (the accessor's own component type and
// normalized flag), the translation filters from the file's own glTF JSON,
// where the meshopt writer records the filter per compressed buffer view.
import { readFile } from 'node:fs/promises'
import type { Document } from '@gltf-transform/core'

// The glTF 2.0 binary container: the 12-byte header and the 8-byte chunk
// header before the JSON chunk, whose type word is 'JSON'.
const GLB_HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8
const JSON_CHUNK_TYPE = 0x4e4f534a

// How one mesh's POSITION is stored, by the mesh's own name.
export type PositionStorageFact = {
  readonly meshName: string
  readonly componentType: number
  readonly normalized: boolean
}

// What filter one animation's translation outputs are stored through.
export type TranslationFilterFact = {
  readonly animationName: string
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

// The translation filter facts of a written model file: every animation
// sampler's output accessor, with the meshopt filter its buffer view
// carries (null when the buffer view is not meshopt-compressed). A file
// that is not GLB, or whose chunks do not open as expected, fails loudly:
// the facts guard the optimize step's own output.
export async function readTranslationFilters(modelPath: string): Promise<TranslationFilterFact[]> {
  const bytes = await readFile(modelPath)
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`${modelPath} is not a glTF 2.0 binary file`)
  }
  let offset = GLB_HEADER_BYTES
  let json: GltfJson | null = null
  while (offset + CHUNK_HEADER_BYTES <= bytes.byteLength) {
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    if (type === JSON_CHUNK_TYPE) {
      json = JSON.parse(
        bytes.toString('utf8', offset + CHUNK_HEADER_BYTES, offset + CHUNK_HEADER_BYTES + length),
      ) as GltfJson
      break
    }
    offset += CHUNK_HEADER_BYTES + length
  }
  if (json === null) {
    throw new Error(`${modelPath} carries no JSON chunk`)
  }
  const facts: TranslationFilterFact[] = []
  for (const animation of json.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      const accessor = (json.accessors ?? [])[sampler.output ?? -1]
      const bufferView = (json.bufferViews ?? [])[accessor?.bufferView ?? -1]
      facts.push({
        animationName: animation.name ?? '',
        filter: bufferView?.extensions?.EXT_meshopt_compression?.filter ?? null,
      })
    }
  }
  return facts
}

// The translation filter facts of an in-memory document: the translation
// outputs the document's animations carry, each declared with the filter
// the meshopt writer stores them through. The rule fixtures represent
// optimized files, and the filter is a property of the compression the
// file went through, which an in-memory document has not: this is the
// declaration the fixtures stand in for, not a read.
export function declaredTranslationFilters(doc: Document): TranslationFilterFact[] {
  const facts: TranslationFilterFact[] = []
  for (const animation of doc.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      const output = sampler.getOutput()
      const targetPaths = new Set(
        animation
          .listChannels()
          .filter((channel) => channel.getSampler() === sampler)
          .map((channel) => channel.getTargetPath()),
      )
      if (output === null || !targetPaths.has('translation')) {
        continue
      }
      facts.push({ animationName: animation.getName(), filter: 'EXPONENTIAL' })
    }
  }
  return facts
}

type GltfJson = {
  readonly animations?: readonly {
    readonly name?: string
    readonly samplers?: readonly { readonly output?: number }[]
  }[]
  readonly accessors?: readonly { readonly bufferView?: number }[]
  readonly bufferViews?: readonly {
    readonly extensions?: {
      readonly EXT_meshopt_compression?: { readonly filter?: string }
    }
  }[]
}
