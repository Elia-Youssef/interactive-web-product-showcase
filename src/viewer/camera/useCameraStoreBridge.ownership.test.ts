import { describe, expect, it, vi } from 'vitest'
import { createAppStore, selectCameraOutcome, selectHomeArrival } from '@store/index'
import { CameraRequestCompletion } from '@lib/camera/requestCompletion'
import { defer, settled, stepFrames } from './cameraRequestFixtures'
import { watchCameraRequests } from './useCameraStoreBridge'

// The generation ownership of the camera request channel, against a real
// store and stand-in moves: a watcher's teardown settles everything its
// generation still owes as one terminal retired outcome for the newest
// owed sequence, and nothing the generation started writes or reports
// after it, so a canvas replacement is never completed by the watcher it
// replaced. A move that fails after it started reaches the typed rejection
// channel, with no unhandled rejection left for the page.

describe('watchCameraRequests ownership', () => {
  it('writes nothing when a started move resolves after the watcher stops', async () => {
    const store = createAppStore()
    const pending = defer()
    const frames = stepFrames()
    const stop = watchCameraRequests(store, () => pending.promise, frames.schedule)

    store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
    await settled()
    expect(selectCameraOutcome(store.getState()), 'the move started and owes an outcome').toBeNull()

    stop()
    pending.resolve()
    await settled()

    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 1,
      request: { kind: 'view', viewId: 'driver' },
      outcome: { kind: 'retired' },
    })
  })

  it('writes nothing and reports nothing when a started move rejects after the watcher stops', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const store = createAppStore()
      const pending = defer()
      const frames = stepFrames()
      const stop = watchCameraRequests(store, () => pending.promise, frames.schedule)

      store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
      await settled()
      stop()
      pending.reject(new Error('the move failed after its watcher retired'))
      await settled()

      expect(selectCameraOutcome(store.getState())).toEqual({
        sequence: 1,
        request: { kind: 'view', viewId: 'driver' },
        outcome: { kind: 'retired' },
      })
      expect(consoleError).not.toHaveBeenCalled()
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
      consoleError.mockRestore()
    }
  })

  it('settles the steps pending at teardown as exactly one retired for the newest', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
    store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
    store.getState().cameraRequest({ kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 })
    stop()

    const retired = {
      sequence: 3,
      request: { kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 },
      outcome: { kind: 'retired' },
    }
    expect(
      selectCameraOutcome(store.getState()),
      'the teardown retires the newest pending step',
    ).toEqual(retired)

    frames.run()
    await settled()
    expect(selectCameraOutcome(store.getState()), 'the dropped frame changes nothing').toEqual(
      retired,
    )
    expect(move).not.toHaveBeenCalled()
  })

  it('keeps a retired watcher from completing the generation that replaced it', async () => {
    const store = createAppStore()
    const pending = defer()
    const frames = stepFrames()
    const stopOne = watchCameraRequests(store, () => pending.promise, frames.schedule)

    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()
    stopOne()
    const moveTwo = vi.fn(() => Promise.resolve())
    const stopTwo = watchCameraRequests(store, moveTwo, frames.schedule)

    pending.resolve()
    await settled()

    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 1,
      request: { kind: 'view', viewId: 'home' },
      outcome: { kind: 'retired' },
    })
    expect(selectHomeArrival(store.getState()), 'the late report arrives nowhere').toBeNull()
    expect(moveTwo, 'the new generation re-executes nothing').not.toHaveBeenCalled()

    // A retired outcome settles its request: the completion read, driven the
    // way the probe drives it, reports the camera idle on the retired record.
    const completion = new CameraRequestCompletion()
    completion.updated(false)
    completion.presented(1, () => ({ azimuth: 1, polar: 2, distance: 3 }))
    expect(completion.read(1, selectCameraOutcome(store.getState())?.sequence ?? 0, 0).idle).toBe(
      true,
    )

    stopTwo()
  })

  it.each(['oldest first', 'newest first'] as const)(
    'settles two overlapping started moves as the one retired of the teardown, %s late',
    async (order) => {
      const store = createAppStore()
      const first = defer()
      const second = defer()
      const moves = [first.promise, second.promise]
      const frames = stepFrames()
      const stop = watchCameraRequests(
        store,
        () => {
          const promise = moves.shift()
          if (promise === undefined) {
            throw new Error('the test ran out of stand-in moves')
          }
          return promise
        },
        frames.schedule,
      )

      store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
      store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
      await settled()
      stop()

      const late = order === 'oldest first' ? [first, second] : [second, first]
      for (const move of late) {
        move.resolve()
        await settled()
      }

      expect(selectCameraOutcome(store.getState())).toEqual({
        sequence: 2,
        request: { kind: 'view', viewId: 'home' },
        outcome: { kind: 'retired' },
      })
    },
  )

  it('reports a failed move as a typed rejection, with no unhandled rejection', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const store = createAppStore()
      const pending = defer()
      const frames = stepFrames()
      const stop = watchCameraRequests(store, () => pending.promise, frames.schedule)

      store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
      const failure = new Error('the move itself failed')
      pending.reject(failure)
      await settled()

      expect(selectCameraOutcome(store.getState())).toEqual({
        sequence: 1,
        request: { kind: 'view', viewId: 'driver' },
        outcome: { kind: 'rejected', reason: 'move-failed' },
      })
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(
        "the camera request #1 view 'driver' was rejected: move-failed",
        failure,
      )
      expect(unhandled, 'the failed move has a handler, so nothing is unhandled').toEqual([])
      stop()
    } finally {
      process.off('unhandledRejection', onUnhandled)
      consoleError.mockRestore()
    }
  })

  it('leaves one record and no live subscription over a thousand watcher lives', () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const frames = stepFrames()
    const realSubscribe = store.subscribe.bind(store)
    let live = 0
    const subscribe = vi.spyOn(store, 'subscribe').mockImplementation((listener) => {
      live += 1
      const unsubscribe = realSubscribe(listener)
      return () => {
        live -= 1
        unsubscribe()
      }
    })

    for (let cycle = 1; cycle <= 1000; cycle += 1) {
      const stop = watchCameraRequests(store, move, frames.schedule)
      store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
      stop()
    }

    expect(live, 'every watcher life ended its subscription').toBe(0)
    expect(move).not.toHaveBeenCalled()
    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 1000,
      request: { kind: 'zoom', steps: 1 },
      outcome: { kind: 'retired' },
    })
    subscribe.mockRestore()
  })
})
