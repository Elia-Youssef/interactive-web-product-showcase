import { describe, expect, it, vi } from 'vitest'
import { createAppStore, selectCameraOutcome, type CameraRequest } from '@store/index'
import type { CameraStep } from '@lib/camera/cameraStep'
import { defer, settled, stepFrames } from './cameraRequestFixtures'
import { watchCameraRequests } from './useCameraStoreBridge'

// The steps of the camera request channel, against a real store and a
// stand-in move, on a step frame the test drives by hand: the steps of one
// frame merge per kind into one move each, answering for the newest request
// they merged; a view request drops the steps still pending; nothing runs
// after the watch ends.

describe('watchCameraRequests steps', () => {
  it.each<{ name: string; steps: readonly CameraStep[]; merged: CameraStep }>([
    {
      name: 'azimuth',
      steps: [
        { kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 },
        { kind: 'rotate', azimuthDegrees: 5, polarDegrees: 0 },
        { kind: 'rotate', azimuthDegrees: 10, polarDegrees: 0 },
      ],
      merged: { kind: 'rotate', azimuthDegrees: 0, polarDegrees: 0 },
    },
    {
      name: 'both orbit axes',
      steps: [
        { kind: 'rotate', azimuthDegrees: 15, polarDegrees: -30 },
        { kind: 'rotate', azimuthDegrees: -15, polarDegrees: 30 },
      ],
      merged: { kind: 'rotate', azimuthDegrees: 0, polarDegrees: 0 },
    },
    {
      name: 'zoom',
      steps: [
        { kind: 'zoom', steps: -3 },
        { kind: 'zoom', steps: 1 },
        { kind: 'zoom', steps: 2 },
      ],
      merged: { kind: 'zoom', steps: 0 },
    },
  ])(
    'reports unchanged for cancelling $name steps, despite an older move',
    async ({ steps, merged }) => {
      const store = createAppStore()
      const older = defer()
      const move = vi.fn(() => older.promise)
      const frames = stepFrames()
      const stop = watchCameraRequests(store, move, frames.schedule)
      store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
      for (const step of steps) {
        store.getState().cameraRequest(step)
      }
      frames.run()
      const expected = {
        sequence: steps.length + 1,
        request: merged,
        outcome: { kind: 'unchanged' },
      }
      expect(selectCameraOutcome(store.getState())).toEqual(expected)
      expect(move).toHaveBeenCalledTimes(1)
      older.resolve()
      await settled()
      expect(selectCameraOutcome(store.getState())).toEqual(expected)
      stop()
    },
  )

  it('runs the steps asked within one frame as one merged move per kind', async () => {
    const store = createAppStore()
    const move = vi.fn<(request: CameraRequest) => Promise<void>>(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    for (let repeat = 0; repeat < 6; repeat += 1) {
      store.getState().cameraRequest({ kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 })
    }
    store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
    store.getState().cameraRequest({ kind: 'zoom', steps: 1 })
    expect(move, 'no step runs before its frame').not.toHaveBeenCalled()

    frames.run()
    await settled()
    expect(move.mock.calls.map(([request]) => request)).toEqual([
      { kind: 'rotate', azimuthDegrees: -90, polarDegrees: 0 },
      { kind: 'zoom', steps: 2 },
    ])
    // The newest merged request settles last on the channel's sequence.
    expect(selectCameraOutcome(store.getState())).toEqual({
      sequence: 8,
      request: { kind: 'zoom', steps: 2 },
      outcome: { kind: 'arrived' },
    })

    store.getState().cameraRequest({ kind: 'rotate', azimuthDegrees: 0, polarDegrees: 15 })
    frames.run()
    await settled()
    expect(move).toHaveBeenCalledTimes(3)
    stop()
  })

  it('drops the steps still pending when a view request arrives', async () => {
    const store = createAppStore()
    const move = vi.fn<(request: CameraRequest) => Promise<void>>(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    store.getState().cameraRequest({ kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 })
    store.getState().cameraRequest({ kind: 'view', viewId: 'home' })
    frames.run()
    await settled()

    expect(move.mock.calls.map(([request]) => request)).toEqual([{ kind: 'view', viewId: 'home' }])
    stop()
  })

  it('runs no pending step after it stops watching', async () => {
    const store = createAppStore()
    const move = vi.fn(() => Promise.resolve())
    const frames = stepFrames()
    const stop = watchCameraRequests(store, move, frames.schedule)

    store.getState().cameraRequest({ kind: 'zoom', steps: -1 })
    stop()
    frames.run()
    await settled()

    expect(move).not.toHaveBeenCalled()
  })
})
