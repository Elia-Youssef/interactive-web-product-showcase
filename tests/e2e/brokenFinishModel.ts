import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A shipped model with its finish mapping broken, built in memory from the
// shipped bytes: the first KHR_materials_variants mapping is pointed at a
// variant index past the file's declared variants. Only the JSON chunk
// changes; the binary chunk, compressed buffers included, is carried over
// untouched, so the file still loads and parses and only the finish plan
// read can object.

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The GLB container constants (glTF 2.0 binary): the 12-byte header, the
// 8-byte chunk header, and the JSON chunk's 4-byte alignment, padded with
// spaces.
const glbHeaderBytes = 12
const chunkHeaderBytes = 8
const chunkAlignment = 4
const jsonChunkType = 0x4e4f534a
const jsonPadByte = 0x20

export type BrokenFinishModel = {
  readonly bytes: Buffer
  // The variant index the broken mapping names, and how many the file
  // declares, as the plan read reports them.
  readonly namedVariant: number
  readonly declaredVariants: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  const entry = isRecord(value) ? value[key] : undefined
  return isRecord(entry) ? entry : null
}

function arrayAt(value: unknown, key: string): readonly unknown[] {
  const entry = isRecord(value) ? value[key] : undefined
  return Array.isArray(entry) ? entry : []
}

// The first mapping any primitive carries, as the mutable JSON object.
function firstMapping(json: unknown): Record<string, unknown> {
  for (const mesh of arrayAt(json, 'meshes')) {
    for (const primitive of arrayAt(mesh, 'primitives')) {
      const variants = recordAt(recordAt(primitive, 'extensions'), 'KHR_materials_variants')
      const mapping = arrayAt(variants, 'mappings')[0]
      if (isRecord(mapping)) {
        return mapping
      }
    }
  }
  throw new Error('the shipped model carries no finish mapping to break')
}

export async function brokenFinishModel(slug: string): Promise<BrokenFinishModel> {
  const shipped = await readFile(path.join(ROOT, 'public', 'models', slug, 'model.glb'))
  const jsonLength = shipped.readUInt32LE(glbHeaderBytes)
  if (shipped.readUInt32LE(glbHeaderBytes + 4) !== jsonChunkType) {
    throw new Error(`the shipped model of ${slug} does not open with its JSON chunk`)
  }
  const jsonStart = glbHeaderBytes + chunkHeaderBytes
  const json: unknown = JSON.parse(shipped.toString('utf8', jsonStart, jsonStart + jsonLength))
  const declaredVariants = arrayAt(
    recordAt(recordAt(json, 'extensions'), 'KHR_materials_variants'),
    'variants',
  ).length
  // The first index past the declared variants: the smallest index the
  // plan read must reject.
  const namedVariant = declaredVariants
  firstMapping(json).variants = [namedVariant]

  const text = Buffer.from(JSON.stringify(json), 'utf8')
  const padded = Math.ceil(text.length / chunkAlignment) * chunkAlignment
  const jsonChunk = Buffer.alloc(chunkHeaderBytes + padded, jsonPadByte)
  jsonChunk.writeUInt32LE(padded, 0)
  jsonChunk.writeUInt32LE(jsonChunkType, 4)
  text.copy(jsonChunk, chunkHeaderBytes)
  const rest = shipped.subarray(jsonStart + jsonLength)
  const header = Buffer.from(shipped.subarray(0, glbHeaderBytes))
  header.writeUInt32LE(glbHeaderBytes + jsonChunk.length + rest.length, 8)
  return {
    bytes: Buffer.concat([header, jsonChunk, rest]),
    namedVariant,
    declaredVariants,
  }
}
