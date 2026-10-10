import { describe, expect, it } from 'vitest'
import { countFinishPixels } from './finishPixels'

const box = { x: 0, y: 0, width: 4, height: 4 }

function image(rgb: readonly number[], alpha?: number) {
  const pixel = alpha === undefined ? rgb : [...rgb, alpha]
  return { width: 4, height: 4, data: Buffer.from(Array.from({ length: 16 }, () => pixel).flat()) }
}

describe('finish pixel direction', () => {
  it.each([undefined, 255])(
    'ranks saturated red below middle gray for RGB(A) with alpha %s',
    (alpha) => {
      const change = countFinishPixels(
        image([255, 0, 0], alpha),
        image([128, 128, 128], alpha),
        box,
      )
      expect(change.changedPixels).toBe(4)
      expect(change.meanFirst).toBeCloseTo(54.213)
      expect(change.meanSecond).toBeCloseTo(128)
      expect(change.meanFirst).toBeLessThan(change.meanSecond)
      const reversed = countFinishPixels(
        image([128, 128, 128], alpha),
        image([255, 0, 0], alpha),
        box,
      )
      expect(reversed.meanFirst).toBe(change.meanSecond)
      expect(reversed.meanSecond).toBe(change.meanFirst)
    },
  )

  it('uses only changed surface pixels and retains exact same-state noise', () => {
    const first = image([255, 0, 0])
    expect(countFinishPixels(first, first, box)).toEqual({
      changedPixels: 0,
      meanFirst: 0,
      meanSecond: 0,
    })
    const second = image([255, 0, 0])
    second.data.set([128, 128, 128], (1 * 4 + 1) * 3)
    const change = countFinishPixels(first, second, box)
    expect(change.changedPixels).toBe(1)
    expect(change.meanFirst).toBeCloseTo(54.213)
    expect(change.meanSecond).toBeCloseTo(128)
  })
})
