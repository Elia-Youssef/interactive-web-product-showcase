import { describe, expect, it } from 'vitest'
import { MarkerExtentSource } from './markerExtentSource'

describe('MarkerExtentSource', () => {
  it('reads the tokens once per stage size and again when the size changes', () => {
    let reads = 0
    const source = new MarkerExtentSource(() => {
      reads += 1
      return { markerHitPx: 40 + reads, focusOutsetPx: 5 }
    })

    expect(source.for({ width: 800, height: 600 })).toEqual({ markerHitPx: 41, focusOutsetPx: 5 })
    expect(source.for({ width: 800, height: 600 })).toEqual({ markerHitPx: 41, focusOutsetPx: 5 })
    expect(reads).toBe(1)

    expect(source.for({ width: 390, height: 523 })).toEqual({ markerHitPx: 42, focusOutsetPx: 5 })
    expect(reads).toBe(2)
    expect(source.for({ width: 390, height: 600 })).toEqual({ markerHitPx: 43, focusOutsetPx: 5 })
    expect(reads).toBe(3)
  })
})
