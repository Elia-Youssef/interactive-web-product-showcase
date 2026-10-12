// The key bits a stored EXPONENTIAL mantissa needs: the filter stores a
// signed mantissa of at most 2^(bits - 1), so each power of two is the last
// magnitude of its width and the next one needs one bit more.
import { describe, expect, it } from 'vitest'
import { keyBitsOfMantissa } from './storageGrid.ts'

describe('keyBitsOfMantissa', () => {
  it('answers the fewest bits whose mantissa range holds the magnitude', () => {
    const rows: readonly (readonly [number, number])[] = [
      [0, 1],
      [1, 1],
      [2, 2],
      [3, 3],
      [1024, 11],
      [1025, 12],
      [2048, 12],
      [2049, 13],
      [32768, 16],
    ]
    for (const [magnitude, bits] of rows) {
      expect(keyBitsOfMantissa(magnitude), String(magnitude)).toBe(bits)
    }
  })

  it('refuses a magnitude no stored mantissa has', () => {
    expect(() => keyBitsOfMantissa(-1)).toThrow(/whole number/)
    expect(() => keyBitsOfMantissa(1.5)).toThrow(/whole number/)
  })
})
