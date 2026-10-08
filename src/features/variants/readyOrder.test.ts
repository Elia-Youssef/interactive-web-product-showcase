import { describe, expect, it } from 'vitest'
import { PendingGate } from '@lib/async/pendingGate'
import { settleWhenReady } from '@viewer/product/productReadyGate'
import { createFinishApplier, type FinishApplier } from './finishApplier'
import { drain, fakeLoad, fakeSettle, nextTurn, ownerOf, SAGE } from './finishApplier.fixtures'

// The order between the first finish application and the presentation's
// ready settle, driven the way the product's effects drive it: the finish
// controller's layout effects create the applier, hold its first
// application on the ready gate and hand it the selection; the
// presentation's passive effect then asks for the ready settle in the same
// task, before any microtask has run. Every settle is resolved by the test's
// own hand.

type Mount = { readonly applier: FinishApplier; readonly unmount: () => void }

function mountFinishes(
  gate: PendingGate,
  world: ReturnType<typeof fakeLoad>,
  settle: () => Promise<void>,
): Mount {
  const applier = createFinishApplier(ownerOf(world.loaded, settle, []))
  const release = gate.hold(applier.firstApplied)
  applier.apply(SAGE)
  return {
    applier,
    unmount: () => {
      release()
      applier.dispose()
    },
  }
}

describe('the ready settle', () => {
  it('runs only after the first application has settled', async () => {
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const gate = new PendingGate()
    const ready: string[] = []

    mountFinishes(gate, world, fake.settle)
    const readySettled = settleWhenReady({
      gate,
      settle: () => {
        ready.push(`ready after ${fake.settleCalls()} finish settles`)
        return Promise.resolve()
      },
      isCancelled: () => false,
    })

    await nextTurn()
    expect(fake.settleCalls()).toBe(1)
    expect(fake.precompiledAtSettle()).toEqual([true])
    expect(ready).toEqual([])

    await drain(fake, 1)
    await readySettled
    expect(ready).toEqual(['ready after 1 finish settles'])
    expect(world.loaded.scene.children.some((child) => child.name === 'FINISH_precompile')).toBe(
      false,
    )
  })

  it('waits for the remounted applier through the StrictMode apply, dispose, apply sequence', async () => {
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const gate = new PendingGate()
    const ready: number[] = []

    // StrictMode mounts the layout effects, unmounts them and mounts them
    // again inside one commit, before any queued step has run.
    mountFinishes(gate, world, fake.settle).unmount()
    mountFinishes(gate, world, fake.settle)
    const readySettled = settleWhenReady({
      gate,
      settle: () => {
        ready.push(fake.settleCalls())
        return Promise.resolve()
      },
      isCancelled: () => false,
    })

    await nextTurn()
    // The disposed applier applied nothing: one precompile per mount.
    expect(fake.settleCalls()).toBe(1)
    expect(ready).toEqual([])

    await drain(fake, 1)
    await readySettled
    expect(ready).toEqual([1])
  })

  it('settles nothing for a presentation cancelled while it waited', async () => {
    const world = fakeLoad()
    const fake = fakeSettle(world)
    const gate = new PendingGate()
    let cancelled = false
    let readySettles = 0

    mountFinishes(gate, world, fake.settle)
    const readySettled = settleWhenReady({
      gate,
      settle: () => {
        readySettles += 1
        return Promise.resolve()
      },
      isCancelled: () => cancelled,
    })
    cancelled = true

    await drain(fake, 1)
    await readySettled
    expect(readySettles).toBe(0)
  })
})
