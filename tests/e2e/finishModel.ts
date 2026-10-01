import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The finish facts of a shipped model, read from the .glb file itself: for
// every variant, the material name every mapped mesh primitive must carry,
// keyed by the file's own tables ('<mesh>:<primitive>'). The runtime plan
// and the automation's finish record are held against this oracle, so a
// runtime that drifted from the shipped file fails here instead of passing
// against a hand-typed expectation.

// The repo root: the parent of the tests folder this file lives in.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// One key of an untyped JSON table, undefined when the table is no object
// or the key is absent.
function keyOf(table: unknown, key: string): unknown {
  return typeof table === 'object' && table !== null && key in table
    ? Reflect.get(table, key)
    : undefined
}

// The raw tables of a glb's JSON chunk. The container is a 12 byte header,
// then the JSON chunk: a 4 byte length, a 4 byte type, the bytes.
function readGltfJson(modelPath: string): unknown {
  const buffer = readFileSync(modelPath)
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'))
}

function readList(table: unknown, key: string, what: string): readonly unknown[] {
  const value = keyOf(table, key)
  if (!Array.isArray(value)) {
    throw new Error(`the ${what} of the model is missing or not a list`)
  }
  return value
}

function readField(table: unknown, key: string, what: string): unknown {
  const value = keyOf(table, key)
  if (typeof value !== 'object' || value === null) {
    throw new Error(`the ${what} of the model is missing`)
  }
  return value
}

function readEntry(list: readonly unknown[], at: number, what: string): unknown {
  const value = list[at]
  if (typeof value !== 'object' || value === null) {
    throw new Error(`the ${what} at ${at} is not an object`)
  }
  return value
}

function readName(table: unknown, what: string): string {
  const value = keyOf(table, 'name')
  if (typeof value !== 'string') {
    throw new Error(`the ${what} of the model has no name`)
  }
  return value
}

type Mapping = { readonly material: number; readonly variants: readonly number[] }

function readMappings(primitive: unknown): readonly Mapping[] {
  const mappings = keyOf(
    keyOf(keyOf(primitive, 'extensions'), 'KHR_materials_variants'),
    'mappings',
  )
  if (!Array.isArray(mappings)) {
    return []
  }
  return mappings.map((entry, at) => {
    const material = keyOf(entry, 'material')
    const variants = keyOf(entry, 'variants')
    if (typeof material !== 'number' || !Array.isArray(variants)) {
      throw new Error(`the mapping at ${at} names no material or no variants`)
    }
    return {
      material,
      variants: variants.filter((variant): variant is number => typeof variant === 'number'),
    }
  })
}

// The expected finish record per variant name: the model's variant list in
// declaration order, each mapped to the material names its mappings give
// the mapped primitives.
export function readFinishExpectations(
  slug: string,
): ReadonlyMap<string, Readonly<Record<string, string>>> {
  const json = readGltfJson(path.join(ROOT, 'public', 'models', slug, 'model.glb'))

  const variantsExtension = readField(
    readField(json, 'extensions', 'extensions table'),
    'KHR_materials_variants',
    'variants extension',
  )
  const variantDefs = readList(variantsExtension, 'variants', 'variants table')
  const variants = variantDefs.map((_, at) =>
    readName(readEntry(variantDefs, at, 'variant'), 'variant'),
  )

  const materialDefs = readList(json, 'materials', 'materials table')
  const materials = materialDefs.map((_, at) =>
    readName(readEntry(materialDefs, at, 'material'), 'material'),
  )

  const meshDefs = readList(json, 'meshes', 'meshes table')
  const byVariant = new Map<string, Record<string, string>>(variants.map((name) => [name, {}]))
  meshDefs.forEach((_, meshIndex) => {
    const mesh = readEntry(meshDefs, meshIndex, 'mesh')
    const primitives = readList(mesh, 'primitives', `the primitives of mesh ${meshIndex}`)
    primitives.forEach((__, primitiveIndex) => {
      const primitive = readEntry(primitives, primitiveIndex, 'primitive')
      for (const mapping of readMappings(primitive)) {
        const materialName = materials[mapping.material]
        if (materialName === undefined) {
          throw new Error(
            `a mapping of mesh ${meshIndex} names the unknown material ${mapping.material}`,
          )
        }
        for (const variantIndex of mapping.variants) {
          const record = byVariant.get(variants[variantIndex] ?? '')
          if (record === undefined) {
            throw new Error(
              `a mapping of mesh ${meshIndex} names the unknown variant ${variantIndex}`,
            )
          }
          record[`${meshIndex}:${primitiveIndex}`] = materialName
        }
      }
    })
  })
  return byVariant
}
