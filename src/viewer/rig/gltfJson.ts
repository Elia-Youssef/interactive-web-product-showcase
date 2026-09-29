// The glTF JSON readers of the rig: the two facts that live in the loaded
// file's JSON, not on the scene graph. The reader is guarded all the way
// down: the parser hands over untyped JSON, and a missing or malformed
// table reads as empty instead of guessing.

const VARIANTS_EXTENSION = 'KHR_materials_variants'

// The node names the loaded file declares, the authority on which scene
// nodes are contract nodes. The loader renames what it adds (mesh objects
// after their mesh definition), so a name must come from this table to
// count.
export function jsonNodeNames(json: unknown): ReadonlySet<string> {
  const names = new Set<string>()
  const nodes = readKey(json, 'nodes')
  if (!Array.isArray(nodes)) {
    return names
  }
  for (const node of nodes) {
    if (typeof node === 'object' && node !== null) {
      const name = readKey(node, 'name')
      if (typeof name === 'string') {
        names.add(name)
      }
    }
  }
  return names
}

// The variant names from the parser JSON's KHR_materials_variants, in
// declaration order, empty when the file carries none.
export function readVariantNames(json: unknown): readonly string[] {
  const variants = readKey(readKey(readKey(json, 'extensions'), VARIANTS_EXTENSION), 'variants')
  if (!Array.isArray(variants)) {
    return []
  }
  return variants
    .map((entry) =>
      typeof entry === 'object' && entry !== null ? readKey(entry, 'name') : undefined,
    )
    .filter((name): name is string => typeof name === 'string')
}

// One key of an untyped JSON table, undefined when the table is no object
// or the key is absent.
function readKey(table: unknown, key: string): unknown {
  return typeof table === 'object' && table !== null && key in table
    ? Reflect.get(table, key)
    : undefined
}
