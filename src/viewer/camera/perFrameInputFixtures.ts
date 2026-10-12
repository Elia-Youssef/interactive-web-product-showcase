import type CameraControlsImpl from 'camera-controls'
import { staged } from './lensEaseFixtures'
import { ControlsFrameClock } from './controlsFrameClock'
// The per-frame input scenarios of the controls' frame clock: a schedule
// of frame and input times, run twice on fresh staged controls, once
// through the clock in the mount hook's own sequence and once stepped by
// the gaps the rule prescribes, so the two camera paths can be compared
// per frame. The staging lives in lensEaseFixtures.ts.

// The steady display the virtual timeline runs at, in milliseconds.
export const FRAME_MS = 1000 / 60
// Continuous input lands just before its frame, the alignment browsers
// give a real drag or wheel spin.
export const INPUT_LEAD_MS = 1.5
// The virtual time the timeline starts at.
export const START_MS = 1000
// The stage aspect the fixtures build the plan at.
export const STAGE_ASPECT = 1.6

export type FrameSchedule = {
  readonly frameTimes: readonly number[]
  // The virtual time of the input that precedes the frame, null when the
  // frame carries none.
  readonly inputTimes: readonly (number | null)[]
}

export type CameraState = { readonly x: number; readonly y: number; readonly z: number }

export type RunResult = {
  readonly dtsSeconds: readonly number[]
  readonly positions: readonly CameraState[]
}

export function scheduleOf(frameCount: number, inputFrames: readonly number[]): FrameSchedule {
  const frameTimes = Array.from({ length: frameCount + 1 }, (_, k) => START_MS + k * FRAME_MS)
  const inputTimes = frameTimes.map((time, k) =>
    inputFrames.includes(k) ? time - INPUT_LEAD_MS : null,
  )
  return { frameTimes, inputTimes }
}

// The steps the rule prescribes: frames whose input ends an idle step
// from that input's own time, every other frame the gap, all computed
// from the schedule the same way the rule computes them.
export function prescribedStepsMs(
  schedule: FrameSchedule,
  idleEndingFrames: readonly number[],
): number[] {
  const steps: number[] = []
  for (let k = 0; k < schedule.frameTimes.length; k += 1) {
    const input = schedule.inputTimes[k]
    const frameTime = schedule.frameTimes[k]
    if (frameTime === undefined) {
      throw new Error(`the schedule must cover frame ${k}`)
    }
    if (k === 0) {
      steps.push(0)
      continue
    }
    const previousFrame = schedule.frameTimes[k - 1]
    if (previousFrame === undefined) {
      throw new Error(`the schedule must cover frame ${k - 1}`)
    }
    if (input !== null && input !== undefined && idleEndingFrames.includes(k)) {
      steps.push(frameTime - input)
    } else {
      steps.push(frameTime - previousFrame)
    }
  }
  return steps
}

// One run of a schedule, stepping the controls through its frames. With a
// clock, in the hook's sequence; without one, by the prescribed steps.
export function runScenario(options: {
  readonly schedule: FrameSchedule
  readonly clocked: boolean
  readonly prescribedSeconds: readonly number[]
  readonly onInput: (controls: CameraControlsImpl, frame: number) => void
}): RunResult {
  const { schedule, clocked, prescribedSeconds, onInput } = options
  const { controls, camera } = staged()
  const clock = new ControlsFrameClock()
  let nowMs = START_MS
  const onMoveStart = () => clock.beginMove(nowMs)
  controls.addEventListener('transitionstart', onMoveStart)
  controls.addEventListener('controlstart', onMoveStart)
  const dtsSeconds: number[] = []
  const positions: CameraState[] = []
  for (let k = 0; k < schedule.frameTimes.length; k += 1) {
    const input = schedule.inputTimes[k]
    const frameTime = schedule.frameTimes[k]
    if (frameTime === undefined) {
      throw new Error(`the schedule must cover frame ${k}`)
    }
    if (input !== null && input !== undefined) {
      nowMs = input
      onInput(controls, k)
    }
    nowMs = frameTime
    const dtSeconds = clocked ? clock.stepSeconds(nowMs) : prescribedSeconds[k]
    if (dtSeconds === undefined) {
      throw new Error(`the schedule must prescribe frame ${k}`)
    }
    dtsSeconds.push(dtSeconds)
    if (clocked) {
      clock.recordUpdate(controls.update(dtSeconds))
    } else {
      controls.update(dtSeconds)
    }
    positions.push({ x: camera.position.x, y: camera.position.y, z: camera.position.z })
  }
  return { dtsSeconds, positions }
}

// Runs one scenario both ways and hands both runs back for the comparison
// the scenarios file asserts.
export function runScenarioBothWays(options: {
  readonly frameCount: number
  readonly inputFrames: readonly number[]
  readonly idleEndingFrames: readonly number[]
  readonly onInput: (controls: CameraControlsImpl, frame: number) => void
}): { readonly clocked: RunResult; readonly stepped: RunResult; readonly prescribed: number[] } {
  const { frameCount, inputFrames, idleEndingFrames, onInput } = options
  const schedule = scheduleOf(frameCount, inputFrames)
  const prescribedMs = prescribedStepsMs(schedule, idleEndingFrames)
  const prescribedSeconds = prescribedMs.map((ms) => ms / 1000)
  const clocked = runScenario({ schedule, clocked: true, prescribedSeconds, onInput })
  const stepped = runScenario({ schedule, clocked: false, prescribedSeconds, onInput })
  return { clocked, stepped, prescribed: prescribedMs }
}
