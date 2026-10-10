// The steps the visitor asks the stage camera for, and their coalescing.
// A step is relative to wherever the camera's current move ends: a turn of
// the orbit, in degrees, or a number of zoom steps (positive toward the
// product). Steps of one kind add, so a held key or a held button that
// repeats faster than the stage draws costs the camera one merged move per
// frame instead of one per repeat, and no repeat is lost.

import { addOrbitTurns, type OrbitTurn } from './orbitStep'

export type CameraStep =
  ({ readonly kind: 'rotate' } & OrbitTurn) | { readonly kind: 'zoom'; readonly steps: number }

export type CameraStepKind = CameraStep['kind']

// Two steps of one kind as the one step they add up to.
export function mergeCameraSteps(a: CameraStep, b: CameraStep): CameraStep {
  if (a.kind === 'rotate' && b.kind === 'rotate') {
    return { kind: 'rotate', ...addOrbitTurns(a, b) }
  }
  if (a.kind === 'zoom' && b.kind === 'zoom') {
    return { kind: 'zoom', steps: a.steps + b.steps }
  }
  throw new Error(`a ${a.kind} step cannot merge with a ${b.kind} step`)
}

// Schedules one flush for the next frame and answers its cancel.
export type FrameSchedule = (flush: () => void) => () => void

// A step as the channel sequenced it: a merged step carries the newest
// sequence of the steps it merged, the request its outcome answers for.
export type SequencedCameraStep = {
  readonly sequence: number
  readonly step: CameraStep
}

// One frame's worth of steps, merged per kind and emitted together at the
// frame. A step added while a frame is pending merges into the pending step
// of its kind; the first step after a flush schedules the next frame. The
// pending steps keep the order their kinds first arrived in. Clearing drops
// what is pending, for a move that supersedes it (a view), disposing
// cancels the scheduled frame, so nothing is emitted after the owner has
// gone, and reading what is pending is the owner's, for the outcomes it
// still owes when it ends before the frame.
export class CameraStepCoalescer {
  private readonly pending = new Map<CameraStepKind, SequencedCameraStep>()
  private cancelFrame: (() => void) | null = null

  constructor(
    private readonly schedule: FrameSchedule,
    private readonly emit: (step: SequencedCameraStep) => void,
  ) {}

  add(step: CameraStep, sequence: number): void {
    const current = this.pending.get(step.kind)
    this.pending.set(step.kind, {
      sequence,
      step: current === undefined ? step : mergeCameraSteps(current.step, step),
    })
    if (this.cancelFrame === null) {
      this.cancelFrame = this.schedule(() => {
        this.cancelFrame = null
        this.flush()
      })
    }
  }

  clear(): void {
    this.pending.clear()
  }

  dispose(): void {
    this.cancelFrame?.()
    this.cancelFrame = null
    this.pending.clear()
  }

  // The steps still waiting for their frame, each with the newest sequence
  // it merged, as a snapshot: what the owner still owes an outcome for when
  // it ends before the frame. The read changes nothing.
  pendingSteps(): readonly SequencedCameraStep[] {
    return [...this.pending.values()]
  }

  private flush(): void {
    const steps = [...this.pending.values()]
    this.pending.clear()
    for (const sequenced of steps) {
      this.emit(sequenced)
    }
  }
}

// A merged step that adds up to nothing (left then right within a frame)
// asks the camera for no move, but still owes its sequence an outcome.
export function isNoStep(step: CameraStep): boolean {
  return step.kind === 'rotate'
    ? step.azimuthDegrees === 0 && step.polarDegrees === 0
    : step.steps === 0
}
