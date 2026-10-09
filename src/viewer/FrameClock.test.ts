import { describe, expect, it, vi } from 'vitest'
import { FrameClock } from './FrameClock'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { StageRetiredError } from './StageRetiredError'
import { StageFramePath } from './StageFramePath'

// Attach both handlers before closing the supply: the observations prove
// rejection identity and that a subsequent frame resolves nothing.
function observe(promise: Promise<void>) {
  const resolved = vi.fn()
  const rejected = vi.fn()
  const done = promise.then(resolved, rejected)
  return { resolved, rejected, done }
}

describe('FrameClock lifetimes', () => {
  it.each(['retire', 'dispose'] as const)(
    'rejects every pending and late waiter on clock %s',
    async (end) => {
      const clock = new FrameClock()
      const life = clock.createFrameLife()
      const pending = [
        observe(clock.onceFrame()),
        observe(clock.onceFrame()),
        observe(life.onceFrame()),
        observe(life.onceFrame()),
      ]

      clock[end]()
      await Promise.all(pending.map((waiter) => waiter.done))
      const reason = pending[0]?.rejected.mock.calls[0]?.[0]
      expect(reason).toBeInstanceOf(StageRetiredError)
      expect(reason).toMatchObject({ reason: end === 'retire' ? 'retired' : 'disposed' })
      for (const waiter of pending) {
        expect(waiter.rejected).toHaveBeenCalledExactlyOnceWith(reason)
        expect(waiter.resolved).not.toHaveBeenCalled()
      }

      for (const waiter of [
        clock.onceFrame(),
        life.onceFrame(),
        clock.createFrameLife().onceFrame(),
      ]) {
        await expect(waiter).rejects.toBe(reason)
      }
      clock.recordFrame(1, 0)
      clock[end]()
      expect(clock.renderedFrames).toBe(0)
      for (const waiter of pending) {
        expect(waiter.resolved).not.toHaveBeenCalled()
        expect(waiter.rejected).toHaveBeenCalledOnce()
      }
    },
  )

  it.each(['retire', 'dispose'] as const)(
    'ends a canvas life on %s without ending the replacement supply',
    async (end) => {
      const clock = new FrameClock()
      const old = clock.createFrameLife()
      const pending = [observe(old.onceFrame()), observe(old.onceFrame())]
      old[end]()
      await Promise.all(pending.map((waiter) => waiter.done))
      const reason = pending[0]?.rejected.mock.calls[0]?.[0]
      expect(reason).toBeInstanceOf(StageRetiredError)
      for (const waiter of pending) {
        expect(waiter.rejected).toHaveBeenCalledExactlyOnceWith(reason)
      }
      await expect(old.onceFrame()).rejects.toBe(reason)

      const fresh = clock.createFrameLife()
      const next = observe(fresh.onceFrame())
      const stage = observe(clock.onceFrame())
      clock.recordFrame(1, 0)
      await Promise.all([next.done, stage.done])
      expect(next.resolved).toHaveBeenCalledOnce()
      expect(stage.resolved).toHaveBeenCalledOnce()
      expect(next.rejected).not.toHaveBeenCalled()
      expect(clock.renderedFrames).toBe(1)
      for (const waiter of pending) {
        expect(waiter.resolved).not.toHaveBeenCalled()
      }
    },
  )

  it('a present retirement ends the canvas frame waiters', async () => {
    const clock = new FrameClock()
    const life = clock.createFrameLife()
    const path = new StageFramePath({ invalidate: vi.fn(), retired: life.retire })
    path.own('content', vi.fn())
    const pending = observe(life.onceFrame())
    expect(
      path.present(() => {
        throw new Error('present broke')
      }),
    ).toBe(false)
    await pending.done
    expect(pending.rejected.mock.calls[0]?.[0]).toBeInstanceOf(StageRetiredError)
    expect(pending.resolved).not.toHaveBeenCalled()
  })

  it('a final stage hold release disposes the clock, while an effect replay keeps it live', async () => {
    const flush: (() => void)[] = []
    const holds = new ResourceHolds<object>((release) => flush.push(release))
    const clock = new FrameClock()
    const pending = observe(clock.createFrameLife().onceFrame())
    holds.hold(clock)
    holds.drop(clock, clock.dispose)
    holds.hold(clock)
    flush.splice(0).forEach((release) => release())
    expect(pending.rejected).not.toHaveBeenCalled()
    holds.drop(clock, clock.dispose)
    flush.splice(0).forEach((release) => release())
    await pending.done
    expect(pending.rejected.mock.calls[0]?.[0]).toMatchObject({ reason: 'disposed' })
    expect(pending.resolved).not.toHaveBeenCalled()
  })
})
