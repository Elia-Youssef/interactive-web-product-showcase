import { describe, expect, it, vi } from 'vitest'
import { createAppStore, selectCameraOutcomes } from '@store/index'
import { CameraNoPlanError, CameraUnknownViewError } from './stageCameraApi'
import { runCameraRequest, watchCameraRequests } from './useCameraStoreBridge'

// The outcome contract of the camera request channel, against a real store
// and a stand-in move, so the recording path the canvas bridge runs is the
// one under test: arrived at rest, the two typed rejections, and two
// overlapping requests that both resolve at the final rest.

// Flushes the microtasks a recorded move resolves through.
async function settled(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

function defer(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('watchCameraRequests', () => {
  it('records arrived once the move comes to rest', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const stop = watchCameraRequests(store, move)

    store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
    await settled()

    expect(move).toHaveBeenCalledTimes(1)
    expect(selectCameraOutcomes(store.getState()).get(1)).toEqual({ kind: 'arrived' })
    stop()
  })

  it('records a no-plan rejection and reports it loudly', async () => {
    const store = createAppStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stop = watchCameraRequests(store, () => {
      throw new CameraNoPlanError()
    })

    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()

    expect(selectCameraOutcomes(store.getState()).get(1)).toEqual({
      kind: 'rejected',
      reason: 'no-plan',
    })
    expect(consoleError).toHaveBeenCalledWith(
      "the camera request #1 view 'home' was rejected: no-plan",
    )
    consoleError.mockRestore()
    stop()
  })

  it('records an unknown-view rejection and reports it loudly', async () => {
    const store = createAppStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stop = watchCameraRequests(store, () => {
      throw new CameraUnknownViewError('driver')
    })

    store.getState().cameraRequest({ kind: 'zoom', direction: 1 })
    await settled()

    expect(selectCameraOutcomes(store.getState()).get(1)).toEqual({
      kind: 'rejected',
      reason: 'unknown-view',
    })
    expect(consoleError).toHaveBeenCalledWith(
      'the camera request #1 a zoom step was rejected: unknown-view',
    )
    consoleError.mockRestore()
    stop()
  })

  it('records both of two overlapping requests arrived at the final rest', async () => {
    const store = createAppStore()
    const first = defer()
    const second = defer()
    const moves = [first.promise, second.promise]
    const stop = watchCameraRequests(store, () => {
      const promise = moves.shift()
      if (promise === undefined) {
        throw new Error('the test ran out of stand-in moves')
      }
      return promise
    })

    store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()
    expect(selectCameraOutcomes(store.getState()).size, 'no rest, no outcome').toBe(0)

    first.resolve()
    second.resolve()
    await settled()

    expect(selectCameraOutcomes(store.getState())).toEqual(
      new Map([
        [1, { kind: 'arrived' }],
        [2, { kind: 'arrived' }],
      ]),
    )
    stop()
  })

  it('runs the same request again when it is dispatched twice', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const stop = watchCameraRequests(store, move)

    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()

    expect(move).toHaveBeenCalledTimes(2)
    expect(selectCameraOutcomes(store.getState()).size).toBe(2)
    stop()
  })
})

describe('runCameraRequest', () => {
  it('reports arrived when the move resolves', async () => {
    const report = vi.fn()
    runCameraRequest(
      7,
      { kind: 'view', viewId: 'home' },
      () => Promise.resolve(),
      report,
      () => {},
    )
    await settled()

    expect(report).toHaveBeenCalledWith({ kind: 'arrived', sequence: 7 })
  })

  it('reports a rejection without awaiting, and never reports arrived', async () => {
    const report = vi.fn()
    const reportRejection = vi.fn()
    runCameraRequest(
      4,
      { kind: 'view', viewId: 'nowhere' },
      () => {
        throw new CameraUnknownViewError('nowhere')
      },
      report,
      reportRejection,
    )
    await settled()

    expect(report).toHaveBeenCalledWith({ kind: 'rejected', sequence: 4, reason: 'unknown-view' })
    expect(report).not.toHaveBeenCalledWith({ kind: 'arrived', sequence: 4 })
    expect(reportRejection).toHaveBeenCalledTimes(1)
  })

  it('rethrows a failure that is not one of the typed move failures', () => {
    const report = vi.fn()
    const boom = new Error('not a move failure')

    expect(() =>
      runCameraRequest(
        1,
        { kind: 'zoom', direction: 1 },
        () => {
          throw boom
        },
        report,
        () => {},
      ),
    ).toThrow(boom)
    expect(report).not.toHaveBeenCalled()
  })
})
