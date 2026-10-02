import { describe, expect, it } from 'vitest'
import type { DecodedScreenshot, RegionBox } from './stagePixels'
import { boxChannelSum, countDifferingPixels, countDifferingPixelsByDirection } from './lookPixels'

// Synthetic RGBA captures for the metric functions: 4 by 4 pixels, one byte
// per channel, laid out like the decode lays them out. The walk keeps one
// pixel inside the box, so the pixels the fixtures change sit at (1, 1) and
// (2, 2), inside the walked area.
function captureOf(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number],
): DecodedScreenshot {
  const bytes = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y)
      const index = (y * width + x) * 4
      bytes[index] = r
      bytes[index + 1] = g
      bytes[index + 2] = b
      bytes[index + 3] = 255
    }
  }
  return { bytes, width, height }
}

const box: RegionBox = { x: 0, y: 0, width: 4, height: 4 }
const inside: RegionBox = { x: 1, y: 1, width: 1, height: 1 }
const black = captureOf(4, 4, () => [0, 0, 0])

describe('boxChannelSum', () => {
  it('sums the three channels over the box', () => {
    const flat = captureOf(4, 4, () => [10, 20, 30])
    // The walked area is the box one pixel inside: 2 by 2 pixels here.
    expect(boxChannelSum(flat, box)).toBe(4 * 60)
  })

  it('keeps one pixel inside the box, so edge rounding leaks nothing', () => {
    // A bright frame on the box's outermost column: the inner walk of the
    // unit box reads only the pixel at (1, 1).
    const edge = captureOf(4, 4, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]))
    expect(boxChannelSum(edge, inside)).toBe(0)
  })
})

describe('countDifferingPixels', () => {
  it('counts zero for identical captures', () => {
    const capture = captureOf(4, 4, (x, y) => [x, y, 7])
    expect(countDifferingPixels(capture, capture, box).count).toBe(0)
  })

  it('counts a pixel whose channels differ, and one whose changes cancel in the sum', () => {
    const brighter = captureOf(4, 4, (x, y) => (x === 1 && y === 1 ? [11, 10, 10] : [0, 0, 0]))
    const canceling = captureOf(4, 4, (x, y) => (x === 1 && y === 1 ? [11, 10, 9] : [0, 0, 0]))
    expect(countDifferingPixels(black, brighter, box).count).toBe(1)
    expect(countDifferingPixels(black, canceling, box).count).toBe(1)
  })
})

describe('countDifferingPixelsByDirection', () => {
  it('splits the change mass by direction', () => {
    // The first capture is brighter at (1, 1) and darker at (2, 2) than the
    // second: the mass splits into the brightening at (1, 1) and the
    // darkening at (2, 2).
    const first = captureOf(4, 4, (x, y) => (x === 1 && y === 1 ? [12, 12, 12] : [0, 0, 0]))
    const second = captureOf(4, 4, (x, y) =>
      x === 1 && y === 1 ? [0, 0, 0] : x === 2 && y === 2 ? [3, 3, 3] : [0, 0, 0],
    )
    expect(countDifferingPixelsByDirection(first, second, box)).toEqual({
      count: 2,
      darkenedSum: 9,
      brightenedSum: 36,
    })
  })

  it('counts a canceled pixel but assigns it no mass', () => {
    const canceling = captureOf(4, 4, (x, y) => (x === 1 && y === 1 ? [11, 10, 9] : [0, 0, 0]))
    const flat = captureOf(4, 4, (x, y) => (x === 1 && y === 1 ? [10, 10, 10] : [0, 0, 0]))
    expect(countDifferingPixelsByDirection(canceling, flat, box)).toEqual({
      count: 1,
      darkenedSum: 0,
      brightenedSum: 0,
    })
  })

  it('reports zero mass for identical captures', () => {
    const capture = captureOf(4, 4, (x, y) => [x, y, 7])
    expect(countDifferingPixelsByDirection(capture, capture, box)).toEqual({
      count: 0,
      darkenedSum: 0,
      brightenedSum: 0,
    })
  })
})
