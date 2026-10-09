import { describe, expect, it } from 'vitest'
import { startPromise } from './startPromise'

describe('startPromise', () => {
  it('settles as the started promise settles', async () => {
    await expect(startPromise(() => Promise.resolve('bytes'))).resolves.toBe('bytes')
    await expect(startPromise(() => Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline',
    )
  })

  it('takes a start that throws before returning its promise as the rejection, never a throw', async () => {
    // A start that escaped as a throw would fail this call itself; the one
    // promise it returns carries the throw, observed here.
    const started = startPromise<string>(() => {
      throw new TypeError('thrown synchronously')
    })

    await expect(started).rejects.toThrow('thrown synchronously')
  })

  it('runs the start inside the call, before it returns', () => {
    let ran = false
    void startPromise(() => {
      ran = true
      return Promise.resolve()
    })

    expect(ran).toBe(true)
  })
})
