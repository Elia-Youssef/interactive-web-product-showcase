// The derived storage bounds: the position error is table-tested against
// the bound the pipeline's own encode/decode measured at each setting, so
// a quantize change upstream moves these numbers and fails here instead of
// silently moving the home-fit allowance; and the key bound is held against
// hand-computed exponent arithmetic.
import { describe, expect, it } from 'vitest'
import { derivePositionStorageError, translationKeyComponentBound } from './storageBounds.ts'
import { KEY_FILTER_BITS, POSITION_QUANTIZE_BITS } from './settings.ts'

// The measured bound per setting, each row one run of the derivation. The
// 14-bit row is the pipeline's own setting; its value was corroborated
// against an independent measurement of the optimized files' vertices
// (about 8.38e-5, the subset a file's vertices reach), which the full
// domain must cover from above.
const TABLE: readonly { readonly bits: number; readonly bound: number }[] = [
  { bits: 14, bound: 0.00008390075151198939 },
  { bits: 12, bound: 0.0002726613388137622 },
]

describe('derivePositionStorageError', () => {
  it('answers the measured bound at each table setting', async () => {
    for (const row of TABLE) {
      await expect(derivePositionStorageError(row.bits)).resolves.toBe(row.bound)
    }
  })

  it('derives the pipeline setting the constants name', async () => {
    await expect(derivePositionStorageError(POSITION_QUANTIZE_BITS)).resolves.toBe(
      0.00008390075151198939,
    )
  })

  it('answers a tighter bound at more bits', async () => {
    const coarse = await derivePositionStorageError(12)
    const fine = await derivePositionStorageError(14)
    expect(fine).toBeLessThan(coarse)
  })

  it('refuses a bit count the quantizer does not take', async () => {
    await expect(derivePositionStorageError(1)).rejects.toThrow(/bits in \[2, 16\]/)
  })
})

describe('translationKeyComponentBound', () => {
  it('is 2 to the minus bits-1 of the largest key component', () => {
    const step = Math.pow(2, 1 - KEY_FILTER_BITS)
    expect(translationKeyComponentBound([1, 0, 0])).toBe(step)
    expect(translationKeyComponentBound([-3, 0.5, 2])).toBeCloseTo(step * 3, 15)
    expect(translationKeyComponentBound([0, 0, 0])).toBe(0)
  })

  it('refuses an empty key', () => {
    expect(() => translationKeyComponentBound([])).toThrow(/at least one component/)
  })
})
