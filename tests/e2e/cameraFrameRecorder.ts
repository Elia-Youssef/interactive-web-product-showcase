import type { Page } from '@playwright/test'

// The page-side recorder of the stage's presented frames: one record per
// rendered frame, with the camera distance the frame presented, read inside
// the page. It exists for the eased-move-after-an-idle proof, which must see
// every presented frame of a move, not a Node-side sample of it: a sample
// read over the protocol can miss whole frames of a move that lasts under a
// second.

// One presented frame: when the read happened, the stage's frame count,
// and the camera distance and azimuth that frame carried.
export type CameraFrameRecord = {
  readonly atMs: number
  readonly frames: number
  readonly distance: number
  readonly azimuth: number
}

// The recording of one move: the click that started it when the recording
// spans one, and every presented frame from the recorder's install on.
export type CameraMoveRecording = {
  readonly clickedAtMs: number | null
  readonly records: readonly CameraFrameRecord[]
}

// The recorder state the install leaves on the window. Test-only: no
// production code reads it.
type MoveRecorderState = {
  clickedAtMs: number | null
  records: { atMs: number; frames: number; distance: number | null; azimuth: number | null }[]
  stop(): void
}

declare global {
  interface Window {
    __moveRecorder?: MoveRecorderState
  }
}

// Installs the recorder. From then on, every presented frame lands in the
// records: the recorder's own rAF callback runs ahead of the stage's
// frame work, which the render loop registers later, and the task it posts
// then runs after that frame has rendered, in the same display frame. The
// task reads the frame count and the live camera read only when the count
// moved, so the records hold exactly the presented frames. The next click
// on the page is timestamped too: the capture listener at the window runs
// before the clicked control's own handler starts the move.
export async function installCameraFrameRecorder(page: Page): Promise<void> {
  await page.evaluate(cameraFrameRecorderBootstrap)
}

export function cameraFrameRecorderBootstrap(): void {
  if (window.__moveRecorder !== undefined) {
    throw new Error('the camera frame recorder is already installed')
  }
  const records: MoveRecorderState['records'] = []
  const channel = new MessageChannel()
  let running = true
  let frameRequest = 0
  let recordedFrames = -1
  channel.port1.onmessage = () => {
    const frames = window.__viewer?.renderedFrames ?? -1
    if (!running || frames === recordedFrames) {
      return
    }
    recordedFrames = frames
    const camera = window.__viewer?.camera ?? null
    records.push({
      atMs: performance.now(),
      frames,
      distance: camera === null ? null : camera.distance,
      azimuth: camera === null ? null : camera.azimuth,
    })
  }
  const tick = () => {
    if (!running) {
      return
    }
    channel.port2.postMessage(0)
    frameRequest = requestAnimationFrame(tick)
  }
  frameRequest = requestAnimationFrame(tick)
  const onClick = () => {
    if (window.__moveRecorder !== undefined) {
      window.__moveRecorder.clickedAtMs = performance.now()
    }
  }
  window.__moveRecorder = {
    clickedAtMs: null,
    records,
    stop() {
      running = false
      cancelAnimationFrame(frameRequest)
      window.removeEventListener('click', onClick, { capture: true })
      channel.port1.close()
      channel.port2.close()
    },
  }
  window.addEventListener('click', onClick, { capture: true, once: true })
}

// Stops the recorder and hands the recording back, failing when a record
// carried no camera read. The click time is null when the recording spans
// no click.
export function stopCameraFrameRecorder(page: Page): Promise<CameraMoveRecording> {
  return page.evaluate(takeCameraFrameRecording, true)
}

// Stops a recording that input other than a click started.
export function stopCameraFrameRecording(page: Page): Promise<CameraMoveRecording> {
  return page.evaluate(takeCameraFrameRecording, false)
}

// Extraction runs inside the page and releases the recorder even when its
// evidence is incomplete, so a failed recording cannot poison the next one.
export function takeCameraFrameRecording(requireClick: boolean): CameraMoveRecording {
  const recorder = window.__moveRecorder
  if (recorder === undefined) {
    throw new Error('the camera frame recorder is not installed')
  }
  recorder.stop()
  delete window.__moveRecorder
  if (requireClick && recorder.clickedAtMs === null) {
    throw new Error('the recorder captured no click, so the move has no start time')
  }
  const records: CameraFrameRecord[] = recorder.records.map((record) => {
    if (record.distance === null || record.azimuth === null) {
      throw new Error('a recorded frame carried no camera read')
    }
    return {
      atMs: record.atMs,
      frames: record.frames,
      distance: record.distance,
      azimuth: record.azimuth,
    }
  })
  return { clickedAtMs: recorder.clickedAtMs, records }
}

// Waits until the recorder holds the given number of presented frames after
// the frame count the call names, then hands the recorder's record count
// back for the poll to compare.
export function countRecordsAfter(page: Page, framesBefore: number): Promise<number> {
  return page.evaluate((before) => {
    const recorder = window.__moveRecorder
    if (recorder === undefined) {
      return -1
    }
    let count = 0
    for (const record of recorder.records) {
      if (record.frames > before) {
        count += 1
      }
    }
    return count
  }, framesBefore)
}
