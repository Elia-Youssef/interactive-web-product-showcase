import { describe, expect, it, vi } from 'vitest'
import { ScrollCompletion, type ScrollPlan } from './ScrollCompletion'

function scroller(target = 100, horizontalTarget = 0) {
  let left = 0
  let top = 0
  const ends = new Set<() => void>()
  const cancel = vi.fn()
  const plan: ScrollPlan = {
    name: 'panel',
    target: { left: horizontalTarget, top: target },
    position: () => ({ left, top }),
    listenEnd: (end) => {
      ends.add(end)
      return () => {
        ends.delete(end)
      }
    },
    start: () => {},
    cancel,
  }
  return {
    plan,
    move: (value: number) => {
      top = value
    },
    moveLeft: (value: number) => {
      left = value
    },
    end: () => {
      for (const end of ends) end()
    },
    listeners: () => ends.size,
    cancel,
  }
}

describe('ScrollCompletion', () => {
  it('retires pending native motion with its target lifetime, once', () => {
    const completion = new ScrollCompletion()
    const panel = scroller()
    const release = completion.start([panel.plan])
    expect(release).toBeTypeOf('function')
    release()
    expect(completion.read().pending).toBe(0)
    expect(panel.cancel).toHaveBeenCalledExactlyOnceWith()
    expect(panel.listeners()).toBe(0)
    release()
    expect(panel.cancel).toHaveBeenCalledExactlyOnceWith()
  })

  it('cancels replaced native motion without letting a retired target cancel its replacement', () => {
    const completion = new ScrollCompletion()
    const old = scroller()
    const current = scroller()
    const releaseOld = completion.start([old.plan])
    const releaseCurrent = completion.start([current.plan])
    expect(old.cancel).toHaveBeenCalledExactlyOnceWith()
    releaseOld()
    expect(current.cancel).not.toHaveBeenCalled()
    expect(completion.read().pending).toBe(1)
    expect(current.listeners()).toBe(1)
    releaseCurrent()
    expect(current.cancel).toHaveBeenCalledExactlyOnceWith()
    expect(completion.read().pending).toBe(0)
  })

  it('leaves independent movement alone after its own native scroll ended', () => {
    const completion = new ScrollCompletion()
    const panel = scroller()
    const release = completion.start([panel.plan])
    panel.move(100)
    panel.end()
    release()
    expect(panel.cancel).not.toHaveBeenCalled()
    expect(panel.listeners()).toBe(0)
    expect(completion.read().pending).toBe(0)
  })

  it('holds state through an arbitrarily long lull and final position until native completion', () => {
    const completion = new ScrollCompletion()
    const panel = scroller()
    completion.start([panel.plan])
    for (let read = 0; read < 20; read += 1) expect(completion.read().pending).toBe(1)
    panel.move(50)
    expect(completion.read().scrollers[0]?.position.top).toBe(50)
    panel.move(100)
    expect(completion.read().pending).toBe(1)
    panel.end()
    expect(completion.read().pending).toBe(0)
    expect(panel.listeners()).toBe(0)
  })

  it('completes a no-scroll target without waiting for an event that cannot occur', () => {
    const completion = new ScrollCompletion()
    const panel = scroller(0)
    completion.start([panel.plan])
    expect(completion.read().pending).toBe(0)
    expect(panel.listeners()).toBe(0)
  })

  it('waits for every nested scroller and removes only retired listeners', () => {
    const completion = new ScrollCompletion()
    const panel = scroller()
    const document = scroller()
    completion.start([panel.plan, document.plan])
    panel.move(100)
    panel.end()
    expect(completion.read().pending).toBe(1)
    panel.move(0)
    completion.start([panel.plan])
    document.end()
    expect(completion.read().pending).toBe(1)
    expect(document.listeners()).toBe(0)
    completion.release()
    expect(completion.read().pending).toBe(0)
    expect(panel.listeners()).toBe(0)
  })

  it('ignores queued retirement and interrupted end events until the current target ends', () => {
    const completion = new ScrollCompletion()
    const panel = scroller(100, 100)
    completion.start([panel.plan])
    completion.start([panel.plan])
    panel.end()
    expect(completion.read().pending).toBe(1)
    expect(panel.listeners()).toBe(1)
    panel.move(50)
    panel.moveLeft(100)
    panel.end()
    expect(completion.read().pending).toBe(1)
    expect(panel.listeners()).toBe(1)
    panel.move(100)
    panel.moveLeft(0)
    panel.end()
    expect(completion.read().pending).toBe(1)
    expect(panel.listeners()).toBe(1)
    panel.moveLeft(100)
    panel.end()
    expect(completion.read().pending).toBe(0)
    expect(panel.listeners()).toBe(0)
  })
})
