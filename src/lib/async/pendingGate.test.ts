import { describe, expect, it } from 'vitest'
import { PendingGate } from './pendingGate'

// A promise the test settles by hand.
function deferred(): {
  promise: Promise<void>
  resolve: () => void
  reject: (cause: Error) => void
} {
  let resolve: () => void = () => undefined
  let reject: (cause: Error) => void = () => undefined
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

// Whether the promise has settled by the end of the current macrotask turn.
async function hasSettled(promise: Promise<void>): Promise<boolean> {
  let settled = false
  void promise.then(() => {
    settled = true
  })
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  return settled
}

describe('PendingGate', () => {
  it('opens at once with nothing held', async () => {
    expect(await hasSettled(new PendingGate().whenSettled())).toBe(true)
  })

  it('waits for every held promise', async () => {
    const gate = new PendingGate()
    const first = deferred()
    const second = deferred()
    gate.hold(first.promise)
    gate.hold(second.promise)

    const open = gate.whenSettled()
    first.resolve()
    expect(await hasSettled(open)).toBe(false)
    second.resolve()
    expect(await hasSettled(open)).toBe(true)
  })

  it('opens on a rejected hold without rejecting itself', async () => {
    const gate = new PendingGate()
    const failing = deferred()
    void failing.promise.catch(() => undefined)
    gate.hold(failing.promise)

    const open = gate.whenSettled()
    failing.reject(new Error('the owner routes its own failure'))
    await expect(open).resolves.toBeUndefined()
  })

  it('leaves a released hold out of every later wait', async () => {
    const gate = new PendingGate()
    const gone = deferred()
    const release = gate.hold(gone.promise)
    release()

    expect(await hasSettled(gate.whenSettled())).toBe(true)
  })

  it('keeps a promise held twice until both holds are released', async () => {
    const gate = new PendingGate()
    const shared = deferred()
    const releaseFirst = gate.hold(shared.promise)
    gate.hold(shared.promise)
    releaseFirst()

    expect(await hasSettled(gate.whenSettled())).toBe(false)
  })
})
