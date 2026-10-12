import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { zoomPercentOfDistance } from '@lib/camera/zoom'
import { DomRectStandIn, staged, STAGE_ASPECT, STEP } from './lensEaseFixtures'
import { readControlsEndOrbit, scaledRangeOf } from './controls'
import { resizeCameraRange } from './resizeCameraRange'

beforeAll(() => vi.stubGlobal('DOMRect', DomRectStandIn))
afterAll(() => vi.unstubAllGlobals())

describe('camera range resize', () => {
  it.each([STAGE_ASPECT, STAGE_ASPECT * 2])(
    'leaves an idle camera unchanged at an equivalent scale, aspect=%s',
    (aspect) => {
      const { controls, camera, plan } = staged()
      expect(controls.update(STEP)).toBe(false)
      const applied = scaledRangeOf(plan, STAGE_ASPECT)
      const before = camera.position.clone()
      const range = resizeCameraRange(controls, plan, applied, aspect)
      expect(controls.update(STEP), 'no resize move or draw is owed').toBe(false)
      expect(camera.position.equals(before)).toBe(true)
      expect(range).toBe(applied)
      controls.dispose()
    },
  )

  it('preserves an eased move through a position-only or equivalent-scale update', () => {
    const { controls, plan } = staged()
    const applied = scaledRangeOf(plan, STAGE_ASPECT)
    void controls.dollyTo(applied.min, true)
    controls.update(STEP)
    const live = controls.distance
    const end = readControlsEndOrbit(controls)
    expect(live).not.toBe(end.distance)
    resizeCameraRange(controls, plan, applied, STAGE_ASPECT)
    expect(controls.distance, 'a scroll cannot snap the unfinished move').toBe(live)
    expect(readControlsEndOrbit(controls)).toEqual(end)
    expect(controls.update(STEP)).toBe(true)
    controls.dispose()
  })

  it('rescales a changed range at the same zoom percentage and orbit angles', () => {
    const { controls, camera, plan } = staged()
    const applied = scaledRangeOf(plan, STAGE_ASPECT)
    const before = readControlsEndOrbit(controls)
    const percent = zoomPercentOfDistance(before.distance, applied)
    const range = resizeCameraRange(controls, plan, applied, STAGE_ASPECT / 2)
    expect(range).toEqual({ min: applied.min * 2, max: applied.max * 2 })
    expect(zoomPercentOfDistance(controls.distance, range)).toBe(percent)
    expect(controls.azimuthAngle).toBe(before.azimuth)
    expect(controls.polarAngle).toBe(before.polar)
    expect(controls.update(STEP)).toBe(true)
    expect(camera.position.length()).toBe(controls.distance)
    controls.dispose()
  })
})
