import { describe, expect, it } from 'vitest'
import { PresentedFrames } from './PresentedFrames'

// The contract, over a fake renderer counter: a tick with no render fires no
// listener, a rendered tick fires each listener once after the counter
// moved, an unsubscribed listener never fires again, and a subscription that
// arrives at rest owes itself one frame.

describe('PresentedFrames', () => {
  it('fires no listener on a loop tick that rendered nothing', () => {
    const frames = new PresentedFrames()
    let fired = 0
    frames.add(() => {
      fired += 1
    })

    frames.rebase(10)
    expect(frames.afterRenderTick(10)).toBe(false)
    expect(fired).toBe(0)
  })

  it('fires each listener once on a rendered tick, after the counter moved', () => {
    const frames = new PresentedFrames()
    // The fake counter the channel is judged against, read by the listeners
    // when they run: a listener must see the counter of the frame it
    // answers, never the one of the frame before.
    let renderCalls = 10
    const firstSeen: number[] = []
    const secondSeen: number[] = []
    frames.add(() => {
      firstSeen.push(renderCalls)
    })
    frames.add(() => {
      secondSeen.push(renderCalls)
    })

    frames.rebase(renderCalls)
    renderCalls = 14
    expect(frames.afterRenderTick(renderCalls)).toBe(true)

    expect(firstSeen).toEqual([14])
    expect(secondSeen).toEqual([14])
  })

  it('stops firing an unsubscribed listener and keeps the others', () => {
    const frames = new PresentedFrames()
    let gone = 0
    let kept = 0
    const release = frames.add(() => {
      gone += 1
    })
    frames.add(() => {
      kept += 1
    })

    frames.rebase(1)
    release()
    expect(frames.afterRenderTick(2)).toBe(true)
    expect(frames.afterRenderTick(3)).toBe(true)

    expect(gone).toBe(0)
    expect(kept).toBe(2)
  })

  it('fails a stale release loudly', () => {
    const frames = new PresentedFrames()
    const release = frames.add(() => {})
    release()
    expect(() => release()).toThrow('stale')
  })

  it('owes a frame to a subscription that arrives while the stage is at rest', () => {
    let invalidated = 0
    const frames = new PresentedFrames()
    frames.ownInvalidate(() => {
      invalidated += 1
    })

    frames.add(() => {})
    expect(invalidated).toBe(1)
  })

  it('answers the first rendered tick after a rebase as a frame', () => {
    const frames = new PresentedFrames()
    let fired = 0
    frames.add(() => {
      fired += 1
    })

    // A counter that moved before the effect run's rebase is not a frame of
    // this run; the first tick past it is.
    frames.rebase(7)
    expect(frames.afterRenderTick(8)).toBe(true)
    expect(fired).toBe(1)
  })
})
