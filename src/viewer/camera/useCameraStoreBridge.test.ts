import { describe, expect, it, vi } from 'vitest'
import { createAppStore, selectCameraOutcome } from '@store/index'
import { defer, settled, stepFrames } from './cameraRequestFixtures'
import { CameraNoPlanError, CameraUnknownViewError } from './stageCameraApi'
import { runCameraRequest, watchCameraRequests } from './useCameraStoreBridge'

// The outcome contract of the camera request channel, against a real store
// and a stand-in move, so the recording path the canvas bridge runs is the
// one under test: arrived at rest, the two typed rejections, and two
// overlapping requests that both resolve at the final rest, the newer one's
// outcome kept. The step frame the steps run on is the test's to drive.

describe('watchCameraRequests', () => {
  it('records arrived once the move comes to rest', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    store.getState().cameraRequest({ kind: 'view', viewId: 'driver' })
    await settled()

    expect(move).toHaveBeenCalledTimes(1)
    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 1,
      request: { kind: 'view', viewId: 'driver' },
      outcome: { kind: 'arrived' },
    })
    stop()
  })

  it('records a no-plan rejection and reports it loudly', async () => {
    const store = createAppStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const frames = stepFrames()
    const stop = watchCameraRequests(
      store,
      () => {
        throw new CameraNoPlanError()
      },
      frames.schedule,
    )

    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()

    expect(selectCameraOutcome(store.getState())?.outcome).toEqual({
      kind: 'rejected',
      reason: 'no-plan',
    })
    expect(consoleError).toHaveBeenCalledWith(
      "the camera request #1 view 'home' was rejected: no-plan",
      expect.any(CameraNoPlanError),
    )
    consoleError.mockRestore()
    stop()
  })

  it('names an orbit turn in a rejection it reports', async () => {
    const store = createAppStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const frames = stepFrames()
    const stop = watchCameraRequests(
      store,
      () => {
        throw new CameraNoPlanError()
      },
      frames.schedule,
    )

    store.getState().cameraRequest({ kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 })
    frames.run()
    await settled()

    expect(consoleError).toHaveBeenCalledWith(
      'the camera request #1 an orbit turn was rejected: no-plan',
      expect.any(CameraNoPlanError),
    )
    consoleError.mockRestore()
    stop()
  })

  it('records an unknown-view rejection and reports it loudly', async () => {
    const store = createAppStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const frames = stepFrames()
    const stop = watchCameraRequests(
      store,
      () => {
        throw new CameraUnknownViewError('driver')
      },
      frames.schedule,
    )

    store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
    frames.run()
    await settled()

    expect(selectCameraOutcome(store.getState())?.outcome).toEqual({
      kind: 'rejected',
      reason: 'unknown-view',
    })
    expect(consoleError).toHaveBeenCalledWith(
      'the camera request #1 a zoom step was rejected: unknown-view',
      expect.any(CameraUnknownViewError),
    )
    consoleError.mockRestore()
    stop()
  })

  it('keeps the newer of two overlapping requests, whichever reports last', async () => {
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
    expect(selectCameraOutcome(store.getState()), 'no rest, no outcome').toBeNull()

    second.resolve()
    await settled()
    first.resolve()
    await settled()

    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 2,
      request: { kind: 'view', viewId: 'home' },
      outcome: { kind: 'arrived' },
    })
    stop()
  })

  it('runs the same request again when it is dispatched twice', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    await settled()

    expect(move).toHaveBeenCalledTimes(2)
    expect(selectCameraOutcome(store.getState())?.sequence).toBe(2)
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

    expect(report).toHaveBeenCalledWith({
      kind: 'arrived',
      sequence: 7,
      request: { kind: 'view', viewId: 'home' },
    })
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

    expect(report).toHaveBeenCalledWith({
      kind: 'rejected',
      sequence: 4,
      request: { kind: 'view', viewId: 'nowhere' },
      reason: 'unknown-view',
    })
    expect(report).toHaveBeenCalledTimes(1)
    expect(reportRejection).toHaveBeenCalledTimes(1)
    expect(reportRejection.mock.calls[0]?.[1]).toBeInstanceOf(CameraUnknownViewError)
  })

  it('rethrows a failure that is not one of the typed move failures', () => {
    const report = vi.fn()
    const boom = new Error('not a move failure')

    expect(() =>
      runCameraRequest(
        1,
        { kind: 'zoom', steps: 1 },
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
