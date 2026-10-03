import { describe, expect, it, vi } from 'vitest'
import { KeyedLoads } from './keyedLoads'

describe('KeyedLoads', () => {
  it('starts one load per key and hands every reader the same entry', () => {
    const load = vi.fn((key: string) => Promise.resolve(`value of ${key}`))
    const loads = new KeyedLoads(load)

    const first = loads.read('a')
    const second = loads.read('a')

    expect(second).toBe(first)
    expect(second.value).toBe(first.value)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the loads of different keys apart', async () => {
    const loads = new KeyedLoads((key: string) => Promise.resolve(`value of ${key}`))

    const a = loads.read('a')
    const b = loads.read('b')

    expect(b).not.toBe(a)
    await expect(a.value).resolves.toBe('value of a')
    await expect(b.value).resolves.toBe('value of b')
  })

  it('starts a fresh load for a key whose entry was forgotten', () => {
    const load = vi.fn((key: string) => Promise.resolve(key))
    const loads = new KeyedLoads(load)

    const first = loads.read('a')
    loads.forget(first)
    const second = loads.read('a')

    expect(second).not.toBe(first)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('leaves a later live entry of the same key alone when a stale entry is forgotten', () => {
    const loads = new KeyedLoads((key: string) => Promise.resolve(key))

    const stale = loads.read('a')
    loads.forget(stale)
    const live = loads.read('a')
    loads.forget(stale)

    expect(loads.read('a')).toBe(live)
  })
})
