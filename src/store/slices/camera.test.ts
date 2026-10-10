import { expect, test } from 'vitest'
import {
  createCameraSlice,
  selectCameraLive,
  selectCameraOutcome,
  selectHomeArrival,
  selectTiltLimit,
  selectZoomLimit,
  selectCameraReadout,
  selectCameraRequestChannel,
  type CameraSliceState,
} from './camera'
import { initialCameraReadout } from './camera.logic'

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: CameraSliceState = {
    cameraReadout: initialCameraReadout,
    cameraRequestChannel: { sequence: 0, request: null },
    cameraOutcome: null,
  }
  const slice = createCameraSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice starts with an idle readout and an empty channel', () => {
  const { read } = makeSlice()

  expect(selectCameraReadout(read())).toEqual({ kind: 'idle' })
  expect(selectCameraRequestChannel(read())).toEqual({ sequence: 0, request: null })
})

test('publishing a live readout carries the exact camera values', () => {
  const { slice, read } = makeSlice()

  slice.cameraPublishReadout({
    kind: 'live',
    azimuth: 2.5,
    distance: 1.75,
    endDistance: 1.75,
    minDistance: 0.875,
    maxDistance: 4.125,
    endPolar: 1,
    minPolar: 0.25,
    maxPolar: 2.75,
  })

  const readout = selectCameraReadout(read())
  expect(readout).toEqual({
    kind: 'live',
    azimuth: 2.5,
    distance: 1.75,
    endDistance: 1.75,
    minDistance: 0.875,
    maxDistance: 4.125,
    endPolar: 1,
    minPolar: 0.25,
    maxPolar: 2.75,
  })
})

test('publishing the same live values twice keeps one live readout', () => {
  const { slice, read } = makeSlice()
  const event = {
    kind: 'live',
    azimuth: 0.25,
    distance: 2,
    endDistance: 2,
    minDistance: 1,
    maxDistance: 4,
    endPolar: 1,
    minPolar: 0.25,
    maxPolar: 2.75,
  } as const

  slice.cameraPublishReadout(event)
  const first = selectCameraReadout(read())
  slice.cameraPublishReadout(event)

  expect(selectCameraReadout(read())).toBe(first)
})

test('publishing idle clears a live readout', () => {
  const { slice, read } = makeSlice()

  slice.cameraPublishReadout({
    kind: 'live',
    azimuth: 1,
    distance: 2,
    endDistance: 2,
    minDistance: 1,
    maxDistance: 4,
    endPolar: 1,
    minPolar: 0.25,
    maxPolar: 2.75,
  })
  slice.cameraPublishReadout({ kind: 'idle' })

  expect(selectCameraReadout(read())).toEqual({ kind: 'idle' })
})

test('requests reach the channel sequenced, the same one twice included', () => {
  const { slice, read } = makeSlice()

  slice.cameraRequest({ kind: 'zoom', steps: 1 })
  expect(selectCameraRequestChannel(read())).toEqual({
    sequence: 1,
    request: { kind: 'zoom', steps: 1 },
  })

  slice.cameraRequest({ kind: 'zoom', steps: 1 })
  expect(selectCameraRequestChannel(read())).toEqual({
    sequence: 2,
    request: { kind: 'zoom', steps: 1 },
  })

  slice.cameraRequest({ kind: 'view', viewId: 'home' })
  expect(selectCameraRequestChannel(read())).toEqual({
    sequence: 3,
    request: { kind: 'view', viewId: 'home' },
  })
})

test('a fresh slice starts with no recorded outcome', () => {
  const { read } = makeSlice()

  expect(selectCameraOutcome(read())).toBeNull()
})

test('a recorded outcome lands in the slice with its sequence, the newest kept', () => {
  const { slice, read } = makeSlice()
  const home = { kind: 'view', viewId: 'home' } as const

  slice.cameraRequestOutcome({ kind: 'arrived', sequence: 1, request: home })
  slice.cameraRequestOutcome({
    kind: 'rejected',
    sequence: 2,
    request: home,
    reason: 'unknown-view',
  })

  expect(selectCameraOutcome(read())).toEqual({
    sequence: 2,
    request: home,
    outcome: { kind: 'rejected', reason: 'unknown-view' },
  })
})

test('the limit selectors read the end state exactly, and nothing while idle', () => {
  const { slice, read } = makeSlice()
  expect(selectCameraLive(read())).toBe(false)
  expect(selectZoomLimit(read())).toBeNull()
  expect(selectTiltLimit(read())).toBeNull()

  const live = {
    kind: 'live',
    azimuth: 0,
    distance: 2,
    endDistance: 2,
    minDistance: 1,
    maxDistance: 4,
    endPolar: 1,
    minPolar: 0.25,
    maxPolar: 2.75,
  } as const
  slice.cameraPublishReadout(live)
  expect(selectCameraLive(read())).toBe(true)
  expect(selectZoomLimit(read())).toBeNull()
  expect(selectTiltLimit(read())).toBeNull()

  slice.cameraPublishReadout({ ...live, endDistance: 1, endPolar: 2.75 })
  expect(selectZoomLimit(read())).toBe('closest')
  expect(selectTiltLimit(read())).toBe('bottom')

  slice.cameraPublishReadout({ ...live, endDistance: 4, endPolar: 0.25 })
  expect(selectZoomLimit(read())).toBe('farthest')
  expect(selectTiltLimit(read())).toBe('top')
})

test('the home arrival is the sequence of the newest request settled at home', () => {
  const { slice, read } = makeSlice()
  expect(selectHomeArrival(read())).toBeNull()

  slice.cameraRequestOutcome({
    kind: 'arrived',
    sequence: 3,
    request: { kind: 'view', viewId: 'home' },
  })
  expect(selectHomeArrival(read())).toBe(3)

  slice.cameraRequestOutcome({ kind: 'arrived', sequence: 4, request: { kind: 'zoom', steps: 1 } })
  expect(selectHomeArrival(read()), 'a newer request moved the camera on').toBeNull()

  slice.cameraRequestOutcome({
    kind: 'rejected',
    sequence: 5,
    request: { kind: 'view', viewId: 'home' },
    reason: 'no-plan',
  })
  expect(selectHomeArrival(read()), 'a rejected request arrived nowhere').toBeNull()

  slice.cameraRequestOutcome({
    kind: 'arrived',
    sequence: 6,
    request: { kind: 'view', viewId: 'driver' },
  })
  expect(selectHomeArrival(read())).toBeNull()
})
