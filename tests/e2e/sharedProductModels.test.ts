// The shared model reader: one read and one loader parse per model per
// process, a fresh copy of the parse for every caller, and no failure
// cached as a success. Proven by counting the real reads and parses through
// spies on the reader classes, over the fixture products' own files.
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NodeIO } from '@gltf-transform/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Object3D } from 'three'
import { fixtureModelPathOf, fixtureProductsDir } from '../../scripts/fixtureProducts.ts'
import { frozen, frozenShallow } from './frozenFacts'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

const FINISH_COLORS = fixtureModelPathOf(ROOT, 'finish-colors')
const PLACEHOLDER_SPEAKER = fixtureModelPathOf(ROOT, 'placeholder-speaker')

// Every test sees the reader as a fresh process sees it: the registry
// resets, so the caches start empty whatever the test before it read.
beforeEach(() => {
  vi.resetModules()
})

// Every node name of a parsed tree, in tree order: the shape a copy of a
// parse must keep.
function nodeNamesOf(root: Object3D): string[] {
  const names: string[] = []
  root.traverse((node) => {
    names.push(node.name)
  })
  return names
}

describe('memoizedRead', () => {
  it('awaits one read for many callers of the same key', async () => {
    const { memoizedRead } = await import('./sharedProductModels')
    const cache = new Map<string, Promise<number>>()
    let reads = 0
    const read = (): Promise<number> => {
      reads += 1
      return Promise.resolve(reads)
    }
    expect(await memoizedRead(cache, 'a', read)).toBe(1)
    expect(await memoizedRead(cache, 'a', read)).toBe(1)
    expect(await memoizedRead(cache, 'b', read)).toBe(2)
    expect(reads).toBe(2)
  })

  it('throws for a failed read every time and retries it on the next call', async () => {
    const { memoizedRead } = await import('./sharedProductModels')
    const cache = new Map<string, Promise<number>>()
    let reads = 0
    const read = (): Promise<number> => {
      reads += 1
      return reads < 3 ? Promise.reject(new Error('broken')) : Promise.resolve(reads)
    }
    await expect(memoizedRead(cache, 'a', read)).rejects.toThrow('broken')
    await expect(memoizedRead(cache, 'a', read)).rejects.toThrow('broken')
    expect(await memoizedRead(cache, 'a', read)).toBe(3)
    expect(await memoizedRead(cache, 'a', read)).toBe(3)
    expect(reads).toBe(3)
  })
})

describe('readSharedModelDocument', () => {
  it('reads one document for every read of the same model', async () => {
    const { readSharedModelDocument } = await import('./sharedProductModels')
    const read = vi.spyOn(NodeIO.prototype, 'read')
    const first = await readSharedModelDocument(FINISH_COLORS)
    const second = await readSharedModelDocument(FINISH_COLORS)
    const third = await readSharedModelDocument(FINISH_COLORS)
    expect(read).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('reads two products into two documents', async () => {
    const { readSharedModelDocument } = await import('./sharedProductModels')
    const read = vi.spyOn(NodeIO.prototype, 'read')
    const finishColors = await readSharedModelDocument(FINISH_COLORS)
    const placeholder = await readSharedModelDocument(PLACEHOLDER_SPEAKER)
    expect(read).toHaveBeenCalledTimes(2)
    expect(placeholder).not.toBe(finishColors)
  })

  it('throws for a missing model every time and reads again on every call', async () => {
    const { readSharedModelDocument } = await import('./sharedProductModels')
    const read = vi.spyOn(NodeIO.prototype, 'read')
    const missing = path.join(fixtureProductsDir(ROOT), 'no-such-product', 'model.glb')
    await expect(readSharedModelDocument(missing)).rejects.toThrow()
    await expect(readSharedModelDocument(missing)).rejects.toThrow()
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('readSharedParsedProduct', () => {
  it('parses one model once and hands every caller its own copy of the tree', async () => {
    const { readSharedParsedProduct } = await import('./sharedProductModels')
    const read = vi.spyOn(NodeIO.prototype, 'read')
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync')
    const first = await readSharedParsedProduct(FINISH_COLORS)
    const second = await readSharedParsedProduct(FINISH_COLORS)
    const third = await readSharedParsedProduct(FINISH_COLORS)
    expect(read).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(second.scene).not.toBe(first.scene)
    expect(third.scene).not.toBe(first.scene)
    expect(third.scene).not.toBe(second.scene)
    expect(nodeNamesOf(third.scene)).toEqual(nodeNamesOf(first.scene))
  })

  it('parses two products separately', async () => {
    const { readSharedParsedProduct } = await import('./sharedProductModels')
    const read = vi.spyOn(NodeIO.prototype, 'read')
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync')
    const finishColors = await readSharedParsedProduct(FINISH_COLORS)
    const placeholder = await readSharedParsedProduct(PLACEHOLDER_SPEAKER)
    expect(read).toHaveBeenCalledTimes(2)
    expect(parse).toHaveBeenCalledTimes(2)
    expect(placeholder.scene).not.toBe(finishColors.scene)
  })

  it('throws for a missing model every time and never reaches the parse', async () => {
    const { readSharedParsedProduct } = await import('./sharedProductModels')
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync')
    const missing = path.join(fixtureProductsDir(ROOT), 'no-such-product', 'model.glb')
    await expect(readSharedParsedProduct(missing)).rejects.toThrow()
    await expect(readSharedParsedProduct(missing)).rejects.toThrow()
    expect(parse).not.toHaveBeenCalled()
  })
})

describe('frozen', () => {
  it('freezes nested arrays, records and tuples', () => {
    const value = frozen({ list: [1, [2, 3]], nested: { deep: 'x' }, tuple: [4, 5, 6] })
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.list)).toBe(true)
    expect(Object.isFrozen(value.list[1])).toBe(true)
    expect(Object.isFrozen(value.nested)).toBe(true)
    expect(Object.isFrozen(value.tuple)).toBe(true)
  })

  it('keeps a lazy getter lazy, so freezing never evaluates one', () => {
    let reads = 0
    const value = frozen({
      get lazy() {
        reads += 1
        return 1
      },
    })
    expect(reads).toBe(0)
    expect(value.lazy).toBe(1)
    expect(reads).toBe(1)
  })

  it('cannot freeze a Map: the freeze stops none of its mutators', () => {
    // What the facts readers lean on for their cached Maps is the
    // ReadonlyMap type and the frozen values they put in, never the freeze.
    const value = frozenShallow(new Map([['a', [1, 2]]]))
    expect(Object.isFrozen(value)).toBe(true)
    value.set('b', [3])
    expect(value.get('b')).toEqual([3])
    value.delete('a')
    expect(value.has('a')).toBe(false)
  })
})
