import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Spherical } from 'three/webgpu'
import { degreesToRadians } from '@lib/camera/limits'
import { orbitTurnOf, tiltStepMoves } from '@lib/camera/orbitStep'
import { DomRectStandIn, STEP, staged } from './lensEaseFixtures'
import { readControlsEnd, readControlsEndOrbit, stepOrbit } from './controls'
import { stageCameraConfig } from './config'

// The orbit step on the real controls, presented at the staged plan's home
// view: every step reads where the current move ends, so steps asked while
// a move eases accumulate exactly, the tilt clamps exactly at the plan's
// polar limits, and the sign is the drag's.

beforeAll(() => vi.stubGlobal('DOMRect', DomRectStandIn))
afterAll(() => vi.unstubAllGlobals())

const right = orbitTurnOf('right', 'coarse', stageCameraConfig)
const up = orbitTurnOf('up', 'coarse', stageCameraConfig)
const down = orbitTurnOf('down', 'coarse', stageCameraConfig)

describe('stepOrbit', () => {
  it('turns right by exactly one step from the end azimuth, lowering it, polar kept', () => {
    const { controls, plan } = staged()
    const before = readControlsEndOrbit(controls)
    void stepOrbit(controls, plan.polarRange, right, true)

    const after = readControlsEndOrbit(controls)
    expect(after.azimuth).toBe(
      before.azimuth - degreesToRadians(stageCameraConfig.rotateStepDegrees),
    )
    expect(after.polar).toBe(before.polar)
    controls.dispose()
  })

  it('accumulates steps asked while the move eases, from where it ends', () => {
    const { controls, plan } = staged()
    const before = readControlsEndOrbit(controls)
    void stepOrbit(controls, plan.polarRange, right, true)
    controls.update(STEP)
    void stepOrbit(controls, plan.polarRange, right, true)

    expect(controls.azimuthAngle, 'the live angle lags the eased move').not.toBe(
      readControlsEndOrbit(controls).azimuth,
    )
    expect(readControlsEndOrbit(controls).azimuth).toBeCloseTo(
      before.azimuth - 2 * degreesToRadians(stageCameraConfig.rotateStepDegrees),
      12,
    )
    controls.dispose()
  })

  it('stops repeated tilt steps exactly on each polar limit', () => {
    const { controls, plan } = staged()
    for (let step = 0; step < 20; step += 1) {
      void stepOrbit(controls, plan.polarRange, up, true)
    }
    const bottom = readControlsEnd(controls, new Spherical()).phi
    expect(bottom).toBe(plan.polarRange.max)
    expect(tiltStepMoves(bottom, plan.polarRange, 'up')).toBe(false)

    for (let step = 0; step < 20; step += 1) {
      void stepOrbit(controls, plan.polarRange, down, true)
    }
    const top = readControlsEnd(controls, new Spherical()).phi
    expect(top).toBe(plan.polarRange.min)
    expect(tiltStepMoves(top, plan.polarRange, 'down')).toBe(false)
    controls.dispose()
  })

  it('lands at once without a transition', () => {
    const { controls, plan } = staged()
    const before = readControlsEndOrbit(controls)
    void stepOrbit(controls, plan.polarRange, right, false)

    expect(controls.azimuthAngle).toBe(
      before.azimuth - degreesToRadians(stageCameraConfig.rotateStepDegrees),
    )
    controls.dispose()
  })
})
