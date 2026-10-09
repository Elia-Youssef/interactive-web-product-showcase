import { describe, expect, it } from 'vitest'
import { alphaRegion, measureShadowFootprint, type ShadowPlane } from './shadowFootprint.ts'
import { rectangularAlpha } from './shadowProduct.fixtures.ts'
import { SHADOW_SETTINGS, SHIPPED_FIT_TOLERANCE_TEXELS } from './shadowSettings.ts'

const plane: ShadowPlane = {
  boundsM: { x: [0, 8], y: [0, 8] },
  uvBoundsM: { x: [0, 8], y: [0, 8] },
}
const settings = {
  alphaThreshold: SHADOW_SETTINGS.alphaThreshold,
  padM: 1,
  fitToleranceTexels: SHADOW_SETTINGS.fitToleranceTexels,
}

describe('shadow pixel-edge geometry', () => {
  it('fits a centered region with the pad on every side', () => {
    const result = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [1, 7], y: [1, 7] }),
      plane,
      settings,
    )
    expect(result.fits).toBe(true)
    expect(result.fittedBoundsM).toEqual(plane.boundsM)
    expect(result.sideDifferencesM).toEqual({ x: [0, 0], y: [0, 0] })
  })

  it('preserves an off-center region instead of mirroring it', () => {
    const shifted = {
      boundsM: { x: [5, 13], y: [-4, 4] },
      uvBoundsM: { x: [5, 13], y: [-4, 4] },
    } as const
    const result = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [1, 6], y: [2, 7] }),
      shifted,
      settings,
    )
    expect(result.alphaBoundsM).toEqual({ x: [6, 11], y: [-2, 3] })
    expect(result.sideDifferencesM).toEqual({ x: [0, 1], y: [-1, 0] })
    expect(result.fits).toBe(true)
  })

  it('maps reversed UV axes in the input row order', () => {
    const result = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [1, 6], y: [2, 7] }),
      { ...plane, uvBoundsM: { x: [8, 0], y: [8, 0] } },
      settings,
    )
    expect(result.alphaBoundsM).toEqual({ x: [2, 7], y: [1, 6] })
    expect(result.fittedBoundsM).toEqual({ x: [1, 8], y: [0, 7] })
    expect(result.fits).toBe(true)
  })

  it('accepts exactly one texel and refuses one texel over', () => {
    const atLimit = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [2, 6], y: [2, 6] }),
      plane,
      settings,
    )
    const over = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [3, 5], y: [3, 5] }),
      plane,
      settings,
    )
    expect(atLimit.sideDifferencesM.x).toEqual([-1, 1])
    expect(atLimit.fits).toBe(true)
    expect(over.sideDifferencesM.x).toEqual([-2, 2])
    expect(over.fits).toBe(false)
  })

  it('refuses one texel beyond the measured shipped allowance', () => {
    const grid = rectangularAlpha(64, 64, { x: [14, 50], y: [14, 50] })
    const largePlane = {
      boundsM: { x: [0, 64], y: [0, 64] },
      uvBoundsM: { x: [0, 64], y: [0, 64] },
    } as const
    const result = measureShadowFootprint(grid, largePlane, {
      ...settings,
      fitToleranceTexels: SHIPPED_FIT_TOLERANCE_TEXELS,
    })
    expect(result.sideDifferencesM.x).toEqual([-13, 13])
    expect(result.fits).toBe(false)
  })

  it('refuses clipping even when the padded sides fit', () => {
    const result = measureShadowFootprint(
      rectangularAlpha(8, 8, { x: [0, 8], y: [0, 8] }),
      plane,
      settings,
    )
    expect(result.fits).toBe(true)
    expect(result.unclipped).toBe(false)
    expect(result.edgeAlpha).toBe(1)
  })

  it('uses the pad in meters independently of texture resolution', () => {
    const grid = rectangularAlpha(8, 8, { x: [2, 6], y: [2, 6] })
    expect(measureShadowFootprint(grid, plane, { ...settings, padM: 0 }).fits).toBe(false)
    expect(measureShadowFootprint(grid, plane, { ...settings, padM: 2 }).fits).toBe(true)
  })

  it('uses strict threshold crossing and allows an edge equal to the threshold', () => {
    const result = alphaRegion(
      { width: 3, height: 3, alpha: [0.03, 0, 0, 0, 0.031, 0, 0, 0, 0] },
      settings.alphaThreshold,
    )
    expect(result).toEqual({ regionPx: { x: [1, 2], y: [1, 2] }, edgeAlpha: 0.03 })
  })

  it.each([
    { width: 0, height: 1, alpha: [] },
    { width: 1, height: 1, alpha: [NaN] },
    { width: 1, height: 1, alpha: [-1] },
    { width: 1, height: 1, alpha: [2] },
    { width: 1, height: 1, alpha: [0] },
  ])('reports unusable alpha data', (grid) => {
    expect(() => alphaRegion(grid, settings.alphaThreshold)).toThrow()
  })
})
