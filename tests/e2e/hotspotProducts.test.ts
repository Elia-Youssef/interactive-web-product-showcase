import { describe, expect, it } from 'vitest'
import { requireHotspotProducts, selectHotspotProducts } from './hotspotProducts'

describe('hotspot product selection', () => {
  const withHotspots = { hotspots: [{ id: 'detail' }] }
  const withoutHotspots = { hotspots: [] }

  it('selects products by their hotspot data and keeps their order and identity', () => {
    const another = { hotspots: [{ id: 'other' }] }
    expect(selectHotspotProducts([withoutHotspots, withHotspots, another])).toEqual([
      withHotspots,
      another,
    ])
    expect(requireHotspotProducts([withoutHotspots, withHotspots], 'marker proof')[0]).toBe(
      withHotspots,
    )
  })

  it('collects an empty selection without throwing', () => {
    expect(selectHotspotProducts([])).toEqual([])
    expect(selectHotspotProducts([withoutHotspots])).toEqual([])
  })

  it('reports both an empty set and an all hotspotless set with the proof name', () => {
    for (const products of [[], [withoutHotspots]]) {
      expect(() => requireHotspotProducts(products, 'card proof')).toThrow(
        'card proof: the product set carries no product with hotspots',
      )
    }
  })
})
