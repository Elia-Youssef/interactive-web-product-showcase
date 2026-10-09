import { describe, expect, it } from 'vitest'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import type { SettleResources } from './StageSettle'
import { StageRetiredError } from './StageRetiredError'

// One stage settle wired to a frame clock the test drives. A step's
// resources carry nothing but its invalidate, so the test counts each
// step's presents through its own counter and answers them by recording
// frames on the clock.
function settleHarness(): {
  clock: FrameClock
  run: (resources: SettleResources) => Promise<void>
  nextStep: () => {
    resources: SettleResources
    presents: () => number
  }
} {
  const clock = new FrameClock()
  const settle = new StageSettle(clock)
  return {
    clock,
    run: (resources: SettleResources) => settle.settle(resources),
    nextStep: () => {
      let count = 0
      return {
        resources: {
          invalidate: () => {
            count += 1
          },
        },
        presents: () => count,
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
  it.each(['retire', 'dispose'] as const)(
    'propagates the clock %s rejection unchanged through pending and queued settles',
    async (end) => {
      const stage = settleHarness()
      const first = stage.nextStep()
      const second = stage.nextStep()
      const firstDone = stage.run(first.resources)
      const secondDone = stage.run(second.resources)
      const results = Promise.allSettled([firstDone, secondDone])
      await nextTurn()
      stage.clock[end]()
      const settled = await results
      const reason = await stage.clock.onceFrame().catch((cause: unknown) => cause)
      expect(reason).toBeInstanceOf(StageRetiredError)
      expect(settled).toEqual([
        { status: 'rejected', reason },
        { status: 'rejected', reason },
      ])
      stage.clock.recordFrame(1, 0)
      await expect(stage.run(stage.nextStep().resources)).rejects.toBe(reason)
    },
  )

  it('rejects a settle when the canvas retires between its two frames', async () => {
    const clock = new FrameClock()
    const life = clock.createFrameLife()
    const settle = new StageSettle(life)
    const done = settle.settle({ invalidate: () => {} })
    const result = Promise.allSettled([done])
    await nextTurn()
    clock.recordFrame(1, 0)
    await nextTurn()
    life.retire()
    const reason = await life.onceFrame().catch((cause: unknown) => cause)
    expect(reason).toBeInstanceOf(StageRetiredError)
    expect(await result).toEqual([{ status: 'rejected', reason }])
  })
  it('presents twice: invalidates, waits for a recorded frame, invalidates again and resolves after the second frame', async () => {
    const stage = settleHarness()
    const first = stage.nextStep()
    const done = stage.run(first.resources)

    // The first present is requested as soon as the step runs.
    await nextTurn()
    expect(first.presents()).toBe(1)

    // The first recorded frame brings the second present, and the step
    // still holds: the settled state is presented twice before it resolves.
    let resolved = false
    void done.then(() => {
      resolved = true
    })
    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    expect(resolved).toBe(false)
    expect(first.presents()).toBe(2)

    // The second recorded frame settles the step.
    stage.clock.recordFrame(performance.now(), 0)
    await done
    expect(resolved).toBe(true)
    expect(first.presents()).toBe(2)
  })

  it('runs one settle at a time: a settle pushed while another presents waits for it', async () => {
    const stage = settleHarness()
    const first = stage.nextStep()
    const firstDone = stage.run(first.resources)
    const second = stage.nextStep()
    const secondDone = stage.run(second.resources)

    await nextTurn()
    // The second settle waits while the first presents: the chain runs one
    // step at a time.
    expect(first.presents()).toBe(1)
    expect(second.presents()).toBe(0)

    // The first step ends with both its frames recorded; the chain then
    // starts the second. The first caller's promise covers the drain, so it
    // resolves only together with the second.
    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    expect(first.presents()).toBe(2)
    expect(second.presents()).toBe(1)

    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await Promise.all([firstDone, secondDone])
    expect(second.presents()).toBe(2)
  })

  it('a settle whose only resources are the invalidate and a frame clock that records frames resolves after two frames', async () => {
    // The class test: the settle over a renderer that offers nothing beyond
    // the invalidate and a frame supply, the capability set every stage
    // renderer has. Its presents ask for nothing else: two recorded frames
    // settle the step, because each present builds the pipelines it draws
    // within its own frame.
    const stage = settleHarness()
    const step = stage.nextStep()
    expect(Object.keys(step.resources)).toEqual(['invalidate'])
    const done = stage.run(step.resources)
    // The frames arrive at frame cadence, one per turn, the way the stage's
    // observer records them.
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await nextTurn()
    stage.clock.recordFrame(performance.now(), 0)
    await done
  })
})
