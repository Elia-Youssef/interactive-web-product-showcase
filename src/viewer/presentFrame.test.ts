import { describe, expect, it, vi } from 'vitest'
import { FrameClock } from './FrameClock'
import { StageFramePath } from './StageFramePath'
import { presentFrame } from './presentFrame'

// A path with a stage owner, its host recorded, and a real frame clock
// whose record and waiter are what the presenter feeds.
function stage() {
  const host = { invalidate: vi.fn<() => void>() }
  const path = new StageFramePath(host)
  const owner = vi.fn<(error: Error) => void>()
  path.own('stage', owner)
  const clock = new FrameClock()
  const record = () => clock.recordFrame(0, 0)
  return { host, path, owner, clock, record }
}

// Resolves with true when the waiter did not settle within a macrotask
// turn: every microtask has run by then.
async function stillPending(waiter: Promise<void>): Promise<boolean> {
  let pending = true
  void waiter.then(() => {
    pending = false
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return pending
}

function throwing(): never {
  throw new Error('the present broke')
}

describe('presentFrame', () => {
  it('records a frame that presented and releases its waiter', async () => {
    const { path, clock, record } = stage()
    const waiter = clock.onceFrame()

    expect(presentFrame(path, () => {}, record)).toBe(true)

    expect(clock.renderedFrames).toBe(1)
    expect(await stillPending(waiter)).toBe(false)
  })

  it('records nothing and releases no waiter for a present that threw', async () => {
    const { path, clock, record, owner } = stage()
    const waiter = clock.onceFrame()

    expect(presentFrame(path, throwing, record)).toBe(false)

    expect(clock.renderedFrames).toBe(0)
    expect(await stillPending(waiter)).toBe(true)
    expect(owner).toHaveBeenCalledOnce()
  })

  it('records nothing and renders nothing on a halted path', async () => {
    const { path, clock, record } = stage()
    path.run('content', throwing)
    const render = vi.fn()
    const waiter = clock.onceFrame()

    expect(presentFrame(path, render, record)).toBe(false)

    expect(render).not.toHaveBeenCalled()
    expect(clock.renderedFrames).toBe(0)
    expect(await stillPending(waiter)).toBe(true)
  })

  it('runs the presented-frame listeners once per presented frame, after the record', () => {
    const { path, clock, record } = stage()
    const seen: number[] = []
    path.listen('content', () => seen.push(clock.renderedFrames))

    presentFrame(path, () => {}, record)
    presentFrame(path, () => {}, record)

    expect(seen).toEqual([1, 2])
  })

  it('never runs a listener for a present that threw or a halted path', () => {
    const { path, record } = stage()
    const listener = vi.fn()
    path.listen('content', listener)

    presentFrame(path, throwing, record)
    presentFrame(path, () => {}, record)

    expect(listener).not.toHaveBeenCalled()
  })

  it('fails the content and halts like a frame callback when a listener throws', () => {
    const { path, record } = stage()
    const product = vi.fn<(error: Error) => void>()
    const releaseProduct = path.own('content', product)
    const later = vi.fn()
    path.listen('content', () => {
      throw new Error('the overlay broke')
    })
    path.listen('content', later)

    expect(presentFrame(path, () => {}, record)).toBe(true)

    expect(product).toHaveBeenCalledOnce()
    expect(later).not.toHaveBeenCalled()
    expect(path.run('content', vi.fn())).toBe(false)
    releaseProduct()
    expect(path.run('content', vi.fn())).toBe(true)
  })
})
