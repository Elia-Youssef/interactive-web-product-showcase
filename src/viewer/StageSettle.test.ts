import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Scene } from 'three'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import type { SettleResources } from './StageSettle'

// One stage settle wired to a controllable fake renderer: each settle gets a
// compile that is a deferred promise the test releases or fails, and the
// frame clock is real, so the step's present-and-verify logic runs against
// recorded frames.
function fakeStage(): {
  clock: FrameClock
  run: (resources: SettleResources) => Promise<void>
  invalidations: () => number
  nextSettle: () => {
    resources: SettleResources
    compiles: () => number
    releaseCompile: () => void
    failCompile: (error: unknown) => void
  }
} {
  const clock = new FrameClock()
  const settle = new StageSettle(clock)
  let invalidationCount = 0
  return {
    clock,
    run: (resources: SettleResources) => settle.settle(resources),
    invalidations: () => invalidationCount,
    nextSettle: () => {
      let resolveCompile: (() => void) | null = null
      let rejectCompile: ((error: unknown) => void) | null = null
      let compileCount = 0
      const compilePromise = new Promise<void>((resolve, reject) => {
        resolveCompile = resolve
        rejectCompile = reject
      })
      const resources: SettleResources = {
        gl: {
          compileAsync: () => {
            compileCount += 1
            return compilePromise
          },
        },
        scene: new Scene(),
        camera: new PerspectiveCamera(),
        invalidate: () => {
          invalidationCount += 1
        },
      }
      return {
        resources,
        compiles: () => compileCount,
        releaseCompile: () => resolveCompile?.(),
        failCompile: (error) => rejectCompile?.(error),
      }
    },
  }
}

// The next macrotask turn: the step's await chain and R3F's frame
// scheduling both settle across macrotasks, never inside one.
function nextTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

describe('StageSettle', () => {
  it('compiles once, invalidates, and resolves after the presented frame', async () => {
    const stage = fakeStage()
    const first = stage.nextSettle()
    const done = stage.run(first.resources)

    // The compile is in flight: the settle holds until the frame lands.
    let resolved = false
    void done.then(() => {
      resolved = true
    })
    await nextTurn()
    expect(resolved).toBe(false)
    expect(first.compiles()).toBe(1)

    first.releaseCompile()
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await done
    expect(resolved).toBe(true)
    expect(first.compiles()).toBe(1)
    expect(stage.invalidations()).toBe(1)
  })

  it('compiles again when a frame raced the compile, then settles', async () => {
    const stage = fakeStage()
    const first = stage.nextSettle()
    const done = stage.run(first.resources)
    await nextTurn()

    // A frame renders while the compile is walking: with the presented
    // frame after it, the compile's resolve is untrusted, so the step
    // compiles again over a drained loop.
    stage.clock.recordFrame(performance.now(), 0)
    first.releaseCompile()
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    expect(first.compiles()).toBe(2)

    first.releaseCompile()
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await done
    expect(first.compiles()).toBe(2)
    expect(stage.invalidations()).toBe(2)
  })

  it('rejects with the compile failure and still runs the next settle', async () => {
    const stage = fakeStage()
    const first = stage.nextSettle()
    const failing = stage.run(first.resources)
    const second = stage.nextSettle()
    const followingDone = stage.run(second.resources)

    first.failCompile(new Error('the compile failed'))
    await expect(failing).rejects.toThrow('the compile failed')

    second.releaseCompile()
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await followingDone
    expect(second.compiles()).toBe(1)
  })

  it('runs one settle at a time: the next compile waits for the presented frame', async () => {
    const stage = fakeStage()
    const first = stage.nextSettle()
    const firstDone = stage.run(first.resources)
    const second = stage.nextSettle()
    const secondDone = stage.run(second.resources)

    first.releaseCompile()
    await nextTurn()
    // The second settle waits while the first compile is in the chain.
    expect(second.compiles()).toBe(0)

    stage.clock.recordFrame(performance.now(), 0)
    // The first step ends with its frame recorded; the chain then starts the
    // second compile. The first caller's promise covers the drain, so it
    // resolves only together with the second.
    second.releaseCompile()
    await nextTurn()
    expect(second.compiles()).toBe(1)

    stage.clock.recordFrame(performance.now(), 0)
    await Promise.all([firstDone, secondDone])
    expect(stage.invalidations()).toBe(2)
  })
})
