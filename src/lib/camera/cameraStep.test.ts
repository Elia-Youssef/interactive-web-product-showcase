import { describe, expect, it } from 'vitest'
import { CameraStepCoalescer, mergeCameraSteps, type CameraStep } from './cameraStep'

// A frame schedule the test drives by hand: each scheduled flush waits in
// the list until the test runs the frame.
function manualFrames() {
  const flushes: (() => void)[] = []
  let cancelled = 0
  return {
    schedule: (flush: () => void) => {
      flushes.push(flush)
      return () => {
        cancelled += 1
        flushes.splice(flushes.indexOf(flush), 1)
      }
    },
    runFrame: () => {
      const due = flushes.splice(0)
      for (const flush of due) {
        flush()
      }
    },
    scheduled: () => flushes.length,
    cancelled: () => cancelled,
  }
}

// The coalescer under test, its emitted steps and their sequences, and a
// sequence that grows per add, the way the request channel numbers them.
function coalescer() {
  const frames = manualFrames()
  const emitted: CameraStep[] = []
  const sequences: number[] = []
  const coalescing = new CameraStepCoalescer(frames.schedule, ({ sequence, step }) => {
    emitted.push(step)
    sequences.push(sequence)
  })
  let sequence = 0
  const steps = {
    add: (step: CameraStep) => {
      sequence += 1
      coalescing.add(step, sequence)
    },
    clear: () => coalescing.clear(),
    dispose: () => coalescing.dispose(),
    pendingSteps: () => coalescing.pendingSteps(),
  }
  return { frames, emitted, sequences, steps }
}

const right: CameraStep = { kind: 'rotate', azimuthDegrees: -15, polarDegrees: 0 }
const up: CameraStep = { kind: 'rotate', azimuthDegrees: 0, polarDegrees: 15 }
const zoomIn: CameraStep = { kind: 'zoom', steps: 1 }

describe('mergeCameraSteps', () => {
  it('adds two turns on both axes', () => {
    expect(mergeCameraSteps(right, up)).toEqual({
      kind: 'rotate',
      azimuthDegrees: -15,
      polarDegrees: 15,
    })
  })

  it('adds zoom steps with their signs', () => {
    expect(mergeCameraSteps(zoomIn, { kind: 'zoom', steps: -3 })).toEqual({
      kind: 'zoom',
      steps: -2,
    })
  })

  it('refuses to merge steps of two kinds', () => {
    expect(() => mergeCameraSteps(right, zoomIn)).toThrow('a rotate step cannot merge')
  })
})

describe('CameraStepCoalescer', () => {
  it('emits nothing until the frame, then one merged step', () => {
    const { frames, emitted, steps } = coalescer()
    for (let repeat = 0; repeat < 10; repeat += 1) {
      steps.add(right)
    }
    expect(emitted).toEqual([])
    expect(frames.scheduled(), 'one frame for any number of repeats').toBe(1)

    frames.runFrame()
    expect(emitted).toEqual([{ kind: 'rotate', azimuthDegrees: -150, polarDegrees: 0 }])
  })

  it('emits at most one step per kind per frame, in the order the kinds arrived', () => {
    const { frames, emitted, sequences, steps } = coalescer()
    steps.add(zoomIn)
    steps.add(right)
    steps.add(zoomIn)
    steps.add(up)
    frames.runFrame()

    expect(emitted).toEqual([
      { kind: 'zoom', steps: 2 },
      { kind: 'rotate', azimuthDegrees: -15, polarDegrees: 15 },
    ])
    expect(sequences, 'each merged step answers for the newest request it merged').toEqual([3, 4])
  })

  it('emits once per frame across frames while the key repeats', () => {
    const { frames, emitted, steps } = coalescer()
    for (let frame = 0; frame < 5; frame += 1) {
      steps.add(right)
      steps.add(right)
      frames.runFrame()
    }
    expect(emitted).toHaveLength(5)
    expect(emitted.every((step) => step.kind === 'rotate' && step.azimuthDegrees === -30)).toBe(
      true,
    )
    expect(frames.scheduled(), 'an idle coalescer schedules no frame').toBe(0)
  })

  it('emits cancelled steps with their newest sequence so they can report an outcome', () => {
    const { frames, emitted, sequences, steps } = coalescer()
    steps.add(right)
    steps.add({ kind: 'rotate', azimuthDegrees: 15, polarDegrees: 0 })
    steps.add(zoomIn)
    steps.add({ kind: 'zoom', steps: -1 })
    frames.runFrame()
    expect(emitted).toEqual([
      { kind: 'rotate', azimuthDegrees: 0, polarDegrees: 0 },
      { kind: 'zoom', steps: 0 },
    ])
    expect(sequences).toEqual([2, 4])
  })

  it('drops the pending steps on clear, and starts afresh after it', () => {
    const { frames, emitted, steps } = coalescer()
    steps.add(right)
    steps.clear()
    frames.runFrame()
    expect(emitted).toEqual([])

    steps.add(up)
    frames.runFrame()
    expect(emitted).toEqual([up])
  })

  it('cancels its frame on dispose and emits nothing after', () => {
    const { frames, emitted, steps } = coalescer()
    steps.add(right)
    steps.dispose()
    expect(frames.cancelled()).toBe(1)
    frames.runFrame()
    expect(emitted).toEqual([])
  })

  it('reads the pending steps as a snapshot, each with its newest sequence', () => {
    const { frames, emitted, steps } = coalescer()
    steps.add(right)
    steps.add(right)
    steps.add(zoomIn)
    const snapshot = steps.pendingSteps()
    expect(snapshot).toEqual([
      { sequence: 2, step: { kind: 'rotate', azimuthDegrees: -30, polarDegrees: 0 } },
      { sequence: 3, step: zoomIn },
    ])
    expect(frames.scheduled(), 'the read schedules no frame of its own').toBe(1)

    steps.add(up)
    expect(steps.pendingSteps(), 'the fresh read carries the merge').toEqual([
      { sequence: 4, step: { kind: 'rotate', azimuthDegrees: -30, polarDegrees: 15 } },
      { sequence: 3, step: zoomIn },
    ])
    expect(snapshot, 'the snapshot already read is not a live view').toEqual([
      { sequence: 2, step: { kind: 'rotate', azimuthDegrees: -30, polarDegrees: 0 } },
      { sequence: 3, step: zoomIn },
    ])

    frames.runFrame()
    expect(steps.pendingSteps()).toEqual([])
    expect(emitted).toHaveLength(2)
  })
})
