import { describe, expect, it } from 'vitest'
import { CameraRequestCompletion } from './requestCompletion'

const pose = { azimuth: 1, polar: 2, distance: 3 }

describe('CameraRequestCompletion', () => {
  it('retains the first presented pose for each request, even when later frames correct it', () => {
    const completion = new CameraRequestCompletion()
    completion.presented(1, () => pose)
    completion.presented(1, () => ({ ...pose, azimuth: 10 }))
    expect(completion.read(1, 1, 0).firstRequestFrame).toEqual({ ...pose, sequence: 1, frame: 1 })
    completion.presented(2, () => ({ ...pose, azimuth: 20 }))
    expect(completion.read(2, 2, 0).firstRequestFrame).toEqual({
      ...pose,
      azimuth: 20,
      sequence: 2,
      frame: 3,
    })
  })

  it('completes only after actual update, present, matching outcome and scene drain', () => {
    const completion = new CameraRequestCompletion()
    completion.updated(false)
    expect(completion.read(1, 1, 0).idle).toBe(false)
    completion.presented(1, () => pose)
    expect(completion.read(1, 0, 0).idle).toBe(false)
    expect(completion.read(1, 1, 1).idle).toBe(false)
    expect(completion.read(2, 1, 0).idle).toBe(false)
    expect(completion.read(1, 1, 0).idle).toBe(true)
  })

  it('holds a gesture and every moving update until a final resting present', () => {
    const completion = new CameraRequestCompletion()
    completion.gesture(true)
    completion.updated(false)
    completion.presented(1, () => pose)
    expect(completion.read(1, 1, 0).idle).toBe(false)
    completion.gesture(false)
    expect(completion.read(1, 1, 0).idle).toBe(false)
    completion.begin()
    completion.updated(true)
    completion.presented(1, () => pose)
    expect(completion.read(1, 1, 0).idle).toBe(false)
    completion.updated(false)
    completion.presented(1, () => pose)
    expect(completion.read(1, 1, 0).idle).toBe(true)
  })

  it('requires an initial present even before any UI request exists', () => {
    const completion = new CameraRequestCompletion()
    expect(completion.read(0, 0, 0).idle).toBe(false)
    completion.updated(false)
    completion.presented(0, () => pose)
    expect(completion.read(0, 0, 0).idle).toBe(true)
  })
})
