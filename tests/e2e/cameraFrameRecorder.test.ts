import { afterEach, describe, expect, it, vi } from 'vitest'
import { cameraFrameRecorderBootstrap, takeCameraFrameRecording } from './cameraFrameRecorder'

afterEach(() => vi.unstubAllGlobals())

function recorderWorld() {
  const target = new EventTarget()
  const request = vi.fn<(callback: FrameRequestCallback) => number>().mockReturnValue(17)
  const cancel = vi.fn()
  const port1 = { onmessage: () => {}, close: vi.fn() }
  const port2 = { postMessage: vi.fn(), close: vi.fn() }
  vi.stubGlobal('window', target)
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = port1
      port2 = port2
    },
  )
  cameraFrameRecorderBootstrap()
  const recorder = window.__moveRecorder
  const callback = request.mock.calls[0]?.[0]
  if (recorder === undefined || callback === undefined) {
    throw new Error('the recorder must install its state and frame callback')
  }
  return { target, request, cancel, port1, port2, recorder, callback }
}

describe('the camera frame recorder lifetime', () => {
  it('cancels the outstanding frame and ignores callbacks already delivered when stopped', () => {
    const world = recorderWorld()
    world.callback(0)
    expect(world.port2.postMessage).toHaveBeenCalledTimes(1)
    const deliveredMessage = world.port1.onmessage
    world.recorder.stop()
    world.request.mockClear()
    world.port2.postMessage.mockClear()
    world.callback(0)
    deliveredMessage()
    expect(world.request).not.toHaveBeenCalled()
    expect(world.cancel).toHaveBeenCalledWith(17)
    expect(world.port2.postMessage).not.toHaveBeenCalled()
    expect(world.recorder.records).toEqual([])
    expect(world.port1.close).toHaveBeenCalledTimes(1)
    expect(world.port2.close).toHaveBeenCalledTimes(1)
  })

  it('removes the click listener before another recording can start', () => {
    const world = recorderWorld()
    const remove = vi.spyOn(world.target, 'removeEventListener')
    world.recorder.stop()
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function), { capture: true })
    world.target.dispatchEvent(new Event('click'))
    expect(world.recorder.clickedAtMs).toBeNull()
  })

  it.each([true, false])(
    'extracts through the same cleanup with requireClick %s',
    (requireClick) => {
      const world = recorderWorld()
      world.target.dispatchEvent(new Event('click'))
      world.recorder.records.push({ atMs: 1, frames: 2, distance: 3, azimuth: 4 })
      expect(takeCameraFrameRecording(requireClick)).toEqual({
        clickedAtMs: world.recorder.clickedAtMs,
        records: [{ atMs: 1, frames: 2, distance: 3, azimuth: 4 }],
      })
      expect(window.__moveRecorder).toBeUndefined()
      expect(world.cancel).toHaveBeenCalledWith(17)
    },
  )

  it('cleans up incomplete evidence and permits a fresh recording', () => {
    recorderWorld()
    expect(() => takeCameraFrameRecording(true)).toThrow('captured no click')
    expect(window.__moveRecorder).toBeUndefined()
    cameraFrameRecorderBootstrap()
    window.__moveRecorder?.records.push({ atMs: 0, frames: 0, distance: null, azimuth: null })
    expect(() => takeCameraFrameRecording(false)).toThrow('no camera read')
    expect(window.__moveRecorder).toBeUndefined()
    cameraFrameRecorderBootstrap()
    expect(takeCameraFrameRecording(false)).toEqual({ clickedAtMs: null, records: [] })
  })
})
