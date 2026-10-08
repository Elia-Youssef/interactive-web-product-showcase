import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { Spherical } from 'three'
import { DomRectStandIn, staged } from './lensEaseFixtures'
import { readControlsEndDistance } from './controls'
import { zoomStepMoves } from '@lib/camera/zoom'

beforeAll(() => vi.stubGlobal('DOMRect', DomRectStandIn))
afterAll(() => vi.unstubAllGlobals())

test.each([
  { distance: 0.3, direction: 1 as const },
  { distance: 1.2, direction: -1 as const },
])(
  'the end distance is exactly the controls limit $distance during an eased move',
  ({ distance, direction }) => {
    const { controls } = staged()
    const range = { min: 0.3, max: 1.2 }
    controls.minDistance = range.min
    controls.maxDistance = range.max
    void controls.rotateTo(0.1, 0.9, false)
    void controls.dollyTo(0.7, false)
    void controls.dollyTo(distance, true)
    const scratch = new Spherical()

    expect(controls.getSpherical(new Spherical(), true).radius).toBe(distance)
    expect(controls.distance).not.toBe(distance)
    const endDistance = readControlsEndDistance(controls, scratch)
    expect(endDistance).toBe(distance)
    expect(zoomStepMoves(endDistance, range, direction)).toBe(false)
    controls.dispose()
  },
)
