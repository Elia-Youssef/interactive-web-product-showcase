// The glTF JSON readers of the rig: the facts that live in the loaded
// file's JSON, not on the scene graph. The reader is guarded all the way
// down: the parser hands over untyped JSON, and a missing or malformed
// table reads as empty instead of guessing. The variant names are read by
// the product domain's own reader, which this module shares.

import { readJsonKey } from '@lib/product'

// The node names the loaded file declares, the authority on which scene
// nodes are contract nodes. The loader renames what it adds (mesh objects
// after their mesh definition), so a name must come from this table to
// count.
export function jsonNodeNames(json: unknown): ReadonlySet<string> {
  const names = new Set<string>()
  const nodes = readJsonKey(json, 'nodes')
  if (!Array.isArray(nodes)) {
    return names
  }
  for (const node of nodes) {
    if (typeof node === 'object' && node !== null) {
      const name = readJsonKey(node, 'name')
      if (typeof name === 'string') {
        names.add(name)
      }
    }
  }
  return names
}
