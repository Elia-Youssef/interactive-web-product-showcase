import { describe, expect, it, vi } from 'vitest'
import { ResourceHolds } from './resourceHolds'

// The holds wired to a hand-run flush: every callback the holds schedule
// waits in a list until the test ends the synchronous work, so each test
// states exactly which calls share one effect flush.
function heldResources() {
  const scheduled: (() => void)[] = []
  const holds = new ResourceHolds<object>((callback) => {
    scheduled.push(callback)
  })
  return {
    holds,
    // Ends the current synchronous work: runs everything scheduled so far.
    endFlush: () => {
      for (const callback of scheduled.splice(0)) {
        callback()
      }
    },
    // The scheduled callbacks, for runs that must happen one by one.
    scheduled,
  }
}

describe('ResourceHolds', () => {
  it.each([2, 3, 8])('keeps a resource until all %i overlapping holders drop it', (count) => {
    const { holds, endFlush } = heldResources()
    const resource = {}
    const release = vi.fn()
    for (let holder = 0; holder < count; holder += 1) {
      holds.hold(resource)
    }
    for (let holder = 1; holder < count; holder += 1) {
      holds.drop(resource, release)
      endFlush()
      expect(release).not.toHaveBeenCalled()
    }
    holds.drop(resource, release)
    endFlush()
    expect(release).toHaveBeenCalledOnce()
  })

  it('rejects a drop without a corresponding holder', () => {
    const { holds } = heldResources()
    expect(() => holds.drop({}, vi.fn())).toThrow('no holder')
    const resource = {}
    holds.hold(resource)
    holds.drop(resource, vi.fn())
    expect(() => holds.drop(resource, vi.fn())).toThrow('no holder')
  })

  it('cancels an obsolete zero-holder release even when the callback is reused', () => {
    const { holds, scheduled } = heldResources()
    const resource = {}
    const release = vi.fn()
    holds.hold(resource)
    holds.drop(resource, release)
    holds.hold(resource)
    holds.drop(resource, release)
    scheduled[0]?.()
    expect(release).not.toHaveBeenCalled()
    scheduled[1]?.()
    expect(release).toHaveBeenCalledOnce()
  })

  it('releases a dropped resource at the end of the flush, never inside it', () => {
    const { holds, endFlush } = heldResources()
    const scene = {}
    const release = vi.fn()

    holds.hold(scene)
    holds.drop(scene, release)
    expect(release).not.toHaveBeenCalled()

    endFlush()
    expect(release).toHaveBeenCalledOnce()
  })

  it('keeps a resource whose hold is taken again in the same flush', () => {
    // The StrictMode mount: setup, simulated cleanup and setup again run in
    // one synchronous flush, so the resource stays live through it.
    const { holds, endFlush } = heldResources()
    const scene = {}
    const release = vi.fn()

    holds.hold(scene)
    endFlush()
    holds.drop(scene, release)
    holds.hold(scene)
    endFlush()

    expect(release).not.toHaveBeenCalled()
  })

  it('keeps a resource handed from one holder to the next in one flush', () => {
    // A remount in one commit: the leaving component's cleanup drops the
    // cached resource and the arriving component's setup holds the same one.
    const { holds, endFlush } = heldResources()
    const scene = {}
    const leaving = vi.fn()

    holds.hold(scene)
    endFlush()
    holds.drop(scene, leaving)
    holds.hold(scene)
    endFlush()
    expect(leaving).not.toHaveBeenCalled()

    // The arriving holder's own unmount releases it, once.
    const arriving = vi.fn()
    holds.drop(scene, arriving)
    endFlush()
    expect(arriving).toHaveBeenCalledOnce()
  })

  it('releases the old resource when the same flush holds a different one', () => {
    // A product swapped for the next: the cleanup drops the old scene and
    // the setup holds the new one; only the old one goes.
    const { holds, endFlush } = heldResources()
    const previous = {}
    const next = {}
    const releasePrevious = vi.fn()

    holds.hold(previous)
    endFlush()
    holds.drop(previous, releasePrevious)
    holds.hold(next)
    endFlush()

    expect(releasePrevious).toHaveBeenCalledOnce()
    const releaseNext = vi.fn()
    holds.drop(next, releaseNext)
    endFlush()
    expect(releaseNext).toHaveBeenCalledOnce()
    expect(releasePrevious).toHaveBeenCalledOnce()
  })

  it('releases once when the resource is dropped, held and dropped again in one flush', () => {
    const { holds, endFlush } = heldResources()
    const scene = {}
    const first = vi.fn()
    const second = vi.fn()

    holds.hold(scene)
    holds.drop(scene, first)
    holds.hold(scene)
    holds.drop(scene, second)
    endFlush()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('fails loudly when a released resource is held or dropped again', () => {
    const { holds, endFlush } = heldResources()
    const scene = {}

    holds.hold(scene)
    holds.drop(scene, vi.fn())
    endFlush()

    expect(() => holds.hold(scene)).toThrow('a released resource was held again')
    expect(() => holds.drop(scene, vi.fn())).toThrow('a released resource was dropped again')
  })

  it('releases independent resources independently, a failing release included', () => {
    const { holds, scheduled } = heldResources()
    const broken = {}
    const healthy = {}
    const releaseHealthy = vi.fn()

    holds.hold(broken)
    holds.hold(healthy)
    holds.drop(broken, () => {
      throw new Error('the release failed')
    })
    holds.drop(healthy, releaseHealthy)

    // Each release is its own scheduled run, so the failure stays loud and
    // stays with its own resource.
    const [runBroken, runHealthy] = scheduled
    expect(runBroken).toBeDefined()
    expect(runHealthy).toBeDefined()
    expect(() => runBroken?.()).toThrow('the release failed')
    runHealthy?.()
    expect(releaseHealthy).toHaveBeenCalledOnce()
  })
})
