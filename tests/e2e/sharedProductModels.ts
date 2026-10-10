import path from 'node:path'
import type { Document, NodeIO } from '@gltf-transform/core'
import { createModelIO } from '../../scripts/modelIo.ts'
import { parseDocumentWithLoader, type ParsedProduct } from './productGltf'

// The one read and parse of each product model per process. Every facts
// reader resolves its model through here instead of reading and parsing
// the same `.glb` on its own, so a spec file's top level facts read costs
// one parse for the first reader and nothing for the rest.
//
// Two things are cached, each keyed by the model's resolved path:
//
// - the gltf-transform document, the side every build-time fact derives
//   from. The loader parse stages this same document in place (it strips
//   the textures and the meshopt wrapper, which no fact reads: the parse
//   runs in Node, where no texture image can load, and no fact the readers
//   derive lives in a texture), so every document reader sees one
//   deterministic state whatever order the readers derive in.
// - the loader parse, the side the runtime facts derive from. The parse is
//   mutable state: the facts readers center it, pose it, and hold its
//   meshes, so no caller ever receives the shared instance itself. Every
//   call hands out a copy of the parsed scene tree; the clip and the raw
//   JSON it carries beside the scene are immutable data and are shared.
//
// A failed read or parse is never cached: the entry is dropped when the
// promise rejects, so the failure throws for every caller and the next
// call reads again.

let sharedIO: Promise<NodeIO> | null = null
const documents = new Map<string, Promise<Document>>()
const parses = new Map<string, Promise<ParsedProduct>>()

// Caches a read's promise per key, dropping the entry when it rejects.
// Second and later calls with the same key await the first read's result;
// a failure throws for every caller and is retried on the next call.
export function memoizedRead<Key, Value>(
  cache: Map<Key, Promise<Value>>,
  key: Key,
  read: () => Promise<Value>,
): Promise<Value> {
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }
  const pending = read()
  cache.set(key, pending)
  void pending.catch(() => cache.delete(key))
  return pending
}

function ioOf(): Promise<NodeIO> {
  sharedIO ??= createModelIO()
  return sharedIO
}

export function readSharedModelDocument(modelPath: string): Promise<Document> {
  return memoizedRead(documents, path.resolve(modelPath), async () =>
    (await ioOf()).read(modelPath),
  )
}

export async function readSharedParsedProduct(modelPath: string): Promise<ParsedProduct> {
  const parsed = await memoizedRead(parses, path.resolve(modelPath), async () =>
    parseDocumentWithLoader(await readSharedModelDocument(modelPath)),
  )
  return { scene: parsed.scene.clone(), animations: parsed.animations, json: parsed.json }
}
