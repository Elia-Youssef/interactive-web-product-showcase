import { describe, expect, it, vi } from 'vitest'
import { StageFramePath } from '@viewer/StageFramePath'
import { createExplodeDriver, type ExplodeDriver } from './explodeDriver'
import type { ExplodePose } from './explodePose'
import { explodeFrame, stepExplodeFrame } from './explodeFrame'

// The explode step run through a real frame path, exactly as the stage's
// frame hook runs it: under the scope the feature names, with both the
// stage and the presented product owning their scopes, as they do while a
// product is on the stage.

const fault = new Error('the explode step broke')

// A pose that holds the assembled pose and throws on any other progress, so
// the driver's first moving step throws from inside the pose.
function poseThatBreaksOnMove(): ExplodePose {
  return {
    apply(t) {
      if (t !== 0) {
        throw fault
      }
    },
    dispose() {},
  }
}

function heldPose(): ExplodePose {
  return { apply() {}, dispose() {} }
}

function ownedPath() {
  const path = new StageFramePath({ invalidate: vi.fn(), retired: vi.fn() })
  const stage = vi.fn<(error: Error) => void>()
  const content = vi.fn<(error: Error) => void>()
  path.own('stage', stage)
  path.own('content', content)
  return { path, stage, content }
}

// A driver that is mid-move: retargeted at 1000 ms toward the exploded
// pose, so a step at 1100 ms moves the progress.
function movingDriver(pose: ExplodePose): ExplodeDriver {
  const driver = createExplodeDriver(pose, 0)
  driver.retarget(1, 1000, false)
  return driver
}

function runStep(path: StageFramePath, driver: ExplodeDriver | null, invalidate = vi.fn()) {
  return path.run(explodeFrame.scope, () => stepExplodeFrame(driver, 1100, invalidate))
}

describe('the explode frame step on the stage frame path', () => {
  it('fails the content, never the stage, when the pose throws', () => {
    const { path, stage, content } = ownedPath()

    expect(runStep(path, movingDriver(poseThatBreaksOnMove()))).toBe(false)

    expect(content).toHaveBeenCalledOnce()
    expect(content).toHaveBeenCalledWith(fault)
    expect(stage).not.toHaveBeenCalled()
  })

  it('fails the content, never the stage, when a reaction on the progress feed throws', () => {
    const { path, stage, content } = ownedPath()
    const driver = movingDriver(heldPose())
    driver.subscribe((progress) => {
      if (progress !== 0) {
        throw fault
      }
    })

    expect(runStep(path, driver)).toBe(false)

    expect(content).toHaveBeenCalledWith(fault)
    expect(stage).not.toHaveBeenCalled()
  })

  it('halts the frames after a failed step, so the broken motion never runs again', () => {
    const { path, content } = ownedPath()
    const driver = movingDriver(poseThatBreaksOnMove())
    runStep(path, driver)
    const later = vi.fn()

    expect(path.run(explodeFrame.scope, later)).toBe(false)
    expect(later).not.toHaveBeenCalled()
    expect(content).toHaveBeenCalledOnce()
  })

  it('owes the next frame while the spring runs and none at rest', () => {
    const { path } = ownedPath()
    const moving = vi.fn()
    const resting = vi.fn()

    expect(runStep(path, movingDriver(heldPose()), moving)).toBe(true)
    expect(runStep(path, createExplodeDriver(heldPose(), 0), resting)).toBe(true)

    expect(moving).toHaveBeenCalledOnce()
    expect(resting).not.toHaveBeenCalled()
  })

  it('steps nothing while no view is presented', () => {
    const { path, stage, content } = ownedPath()
    const invalidate = vi.fn()

    expect(runStep(path, null, invalidate)).toBe(true)

    expect(invalidate).not.toHaveBeenCalled()
    expect(stage).not.toHaveBeenCalled()
    expect(content).not.toHaveBeenCalled()
  })
})
