import { describe, expect, it, vi } from 'vitest'
import { RetriedLoad } from './retriedLoad'

describe('RetriedLoad', () => {
  it('starts one load and hands every reader the same promise', async () => {
    const load = vi.fn(() => Promise.resolve('decoder'))
    const shared = new RetriedLoad(load)

    const first = shared.read()
    const second = shared.read()

    expect(second).toBe(first)
    await expect(second).resolves.toBe('decoder')
    expect(shared.read()).toBe(first)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('fails every reader that holds the failed load, then loads again on the next read', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(Promise.reject(new Error('the import failed')))
      .mockReturnValueOnce(Promise.resolve('decoder'))
    const shared = new RetriedLoad(load)

    const first = shared.read()
    const second = shared.read()
    await expect(first).rejects.toThrow('the import failed')
    await expect(second).rejects.toThrow('the import failed')

    await expect(shared.read()).resolves.toBe('decoder')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('takes a load that throws before returning a promise as a rejection', async () => {
    const shared = new RetriedLoad<string>(() => {
      throw new Error('thrown synchronously')
    })

    await expect(shared.read()).rejects.toThrow('thrown synchronously')
  })
})
