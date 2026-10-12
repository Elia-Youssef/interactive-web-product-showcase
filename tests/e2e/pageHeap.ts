import type { CDPSession } from '@playwright/test'

// The JS heap the page's own code holds, read through the engine's protocol
// on the Chromium builds.
//
// The engine's used heap size is no measure of what a page retains: it
// also counts the compiled code the optimizer keeps adding as the same code
// paths run again, which grows over every repeated walk by itself, and the
// embedder's own records (the performance timeline, the inspector's network
// records), which grow with every navigation the page makes. So the reading
// is taken from a heap snapshot after a full collection: the size of every
// JS value the page's scripts can reach (objects, functions, arrays,
// strings, numbers, symbols, regular expressions), plus the backing stores
// of its array buffers, where a product's geometry lives. Compiled code,
// the engine's object shapes and the embedder's native records are left
// out: none of them is something the page created and can fail to let go.

// The snapshot node types that are JS values.
const VALUE_NODE_TYPES: ReadonlySet<string> = new Set([
  'object',
  'closure',
  'array',
  'string',
  'concatenated string',
  'sliced string',
  'regexp',
  'number',
  'symbol',
  'bigint',
])

type SnapshotNodes = {
  readonly fields: readonly string[]
  readonly types: readonly string[]
  readonly nodes: readonly number[]
}

export async function readPageHeap(session: CDPSession): Promise<number> {
  await session.send('HeapProfiler.collectGarbage')
  const chunks: string[] = []
  const onChunk = (event: { readonly chunk: string }) => {
    chunks.push(event.chunk)
  }
  session.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  try {
    await session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  } finally {
    session.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  }
  const values = valueBytes(snapshotNodes(JSON.parse(chunks.join(''))))
  const usage = await session.send('Runtime.getHeapUsage')
  return values + usage.backingStorageSize
}

function valueBytes({ fields, types, nodes }: SnapshotNodes): number {
  const stride = fields.length
  const typeField = fields.indexOf('type')
  const sizeField = fields.indexOf('self_size')
  if (typeField < 0 || sizeField < 0) {
    throw new Error('the heap snapshot nodes carry no type or self size field')
  }
  let bytes = 0
  for (let node = 0; node < nodes.length; node += stride) {
    const type = types[at(nodes, node + typeField)]
    if (type === undefined) {
      throw new Error(`the heap snapshot node at ${node} has a type outside the snapshot's types`)
    }
    if (VALUE_NODE_TYPES.has(type)) {
      bytes += at(nodes, node + sizeField)
    }
  }
  return bytes
}

function at(nodes: readonly number[], index: number): number {
  const value = nodes[index]
  if (value === undefined) {
    throw new Error(`the heap snapshot ends inside a node, at ${index}`)
  }
  return value
}

// The parts of the snapshot the reading uses, checked at the boundary.
function snapshotNodes(parsed: unknown): SnapshotNodes {
  const meta = read(read(parsed, 'snapshot'), 'meta')
  const fields = read(meta, 'node_fields')
  const types = read(meta, 'node_types')
  const nodes = read(parsed, 'nodes')
  const nodeTypes: unknown = Array.isArray(types) ? types[0] : undefined
  if (!isStrings(fields) || !isStrings(nodeTypes) || !isNumbers(nodes)) {
    throw new Error('the heap snapshot does not have the node layout the reading expects')
  }
  return { fields, types: nodeTypes, nodes }
}

function read(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined
}

function isStrings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isNumbers(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number')
}
