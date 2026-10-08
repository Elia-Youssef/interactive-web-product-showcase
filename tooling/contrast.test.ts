import { expect, test } from 'vitest'
import { compositeOver, contrastRatio, relativeLuminance } from './contrast.ts'
import type { Rgb } from './contrast.ts'

test('relative luminance matches the WCAG reference values', () => {
  const rows: [Rgb, number][] = [
    [[0, 0, 0], 0],
    [[255, 255, 255], 1],
    [[16, 18, 18], 0.00586],
    [[27, 31, 32], 0.01317],
    [[160, 160, 160], 0.35153],
  ]
  for (const [rgb, luminance] of rows) {
    expect(relativeLuminance(rgb)).toBeCloseTo(luminance, 4)
  }
})

test('the contrast ratio is symmetric and spans 1 to 21', () => {
  expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6)
  expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 6)
  expect(contrastRatio([90, 90, 90], [90, 90, 90])).toBe(1)
  expect(contrastRatio([255, 255, 255], [16, 18, 18])).toBeCloseTo(18.8, 1)
})

test('compositing blends each channel by alpha', () => {
  expect(compositeOver({ rgb: [255, 255, 255], alpha: 0 }, [10, 20, 30])).toEqual([10, 20, 30])
  expect(compositeOver({ rgb: [255, 255, 255], alpha: 1 }, [10, 20, 30])).toEqual([255, 255, 255])
  expect(compositeOver({ rgb: [200, 100, 0], alpha: 0.5 }, [0, 100, 200])).toEqual([100, 100, 100])
})
