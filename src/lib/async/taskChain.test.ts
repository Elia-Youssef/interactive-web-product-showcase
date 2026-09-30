import { describe, expect, it, vi } from 'vitest'
import { TaskChain } from './taskChain'

// A task whose body is a deferred promise the test controls: the promise
// exists from the start, so finish and fail work before the chain starts
// the task's body.
function deferredTask(): {
  run: () => Promise<void>
  finish: () => void
  fail: (error: unknown) => void
} {
  let resolveIt: (() => void) | null = null
  let rejectIt: ((error: unknown) => void) | null = null
  const promise = new Promise<void>((resolve, reject) => {
    resolveIt = resolve
    rejectIt = reject
  })
  return {
    run: () => promise,
    finish: () => resolveIt?.(),
    fail: (error) => rejectIt?.(error),
  }
}

// Waits until the chain has started every task pushed so far: each push
// chains onto the previous task's start, so one microtask turn per queued
// task settles the order.
async function drainMicrotasks(turns = 8): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve()
  }
}

// Resolves with true when the promise did not settle within a macrotask
// turn: the only way a unit test can see a promise still pending.
async function stillPending(promise: Promise<void>): Promise<boolean> {
  let pending = true
  void promise.then(
    () => {
      pending = false
    },
    () => {
      pending = false
    },
  )
  await new Promise<void>((resolve) => setTimeout(resolve, 10))
  return pending
}

describe('TaskChain', () => {
  it('runs pushed tasks one after another, in push order', async () => {
    const chain = new TaskChain()
    const order: string[] = []
    const first = deferredTask()
    const second = deferredTask()
    const firstDone = chain.push(async () => {
      order.push('first-start')
      await first.run()
      order.push('first-end')
    })
    const secondDone = chain.push(async () => {
      order.push('second-start')
      await second.run()
      order.push('second-end')
    })

    await drainMicrotasks()
    // The second task waits for the first: only the first has started.
    expect(order).toEqual(['first-start'])

    first.finish()
    await drainMicrotasks()
    expect(order).toEqual(['first-start', 'first-end', 'second-start'])

    second.finish()
    await Promise.all([firstDone, secondDone])
    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end'])
  })

  it('resolves a caller only when the chain has drained around its task', async () => {
    const chain = new TaskChain()
    const first = deferredTask()
    const second = deferredTask()
    const firstDone = chain.push(() => first.run())
    const secondDone = chain.push(() => second.run())

    await drainMicrotasks()
    first.finish()
    // The first task is over, but the second was pushed while it ran: the
    // first caller waits for it too.
    expect(await stillPending(firstDone)).toBe(true)

    second.finish()
    await Promise.all([firstDone, secondDone])
  })

  it('rejects a failing task in its own caller and keeps the chain running', async () => {
    const chain = new TaskChain()
    const failure = new Error('the compile failed')
    const first = deferredTask()
    const second = deferredTask()
    const firstDone = chain.push(() => first.run())
    const secondRan = vi.fn()
    const secondDone = chain.push(async () => {
      await second.run()
      secondRan()
    })

    await drainMicrotasks()
    first.fail(failure)
    await expect(firstDone).rejects.toBe(failure)

    second.finish()
    await secondDone
    expect(secondRan).toHaveBeenCalledTimes(1)
  })

  it('resolves callers of a chain that runs dry, then drains again on a later push', async () => {
    const chain = new TaskChain()
    const only = deferredTask()
    const done = chain.push(() => only.run())
    only.finish()
    await done

    const next = deferredTask()
    const nextDone = chain.push(() => next.run())
    await drainMicrotasks()
    next.finish()
    await nextDone
  })
})
