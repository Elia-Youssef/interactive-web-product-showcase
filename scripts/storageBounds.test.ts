// The derived storage bounds: the position error is table-tested against
// the bound the pipeline's own encode/decode measured at each setting, so
// a quantize change upstream moves these numbers and fails here instead of
// silently moving the home-fit allowance; and the key bound is held against
// the installed encoder and decoder's own round trip.
import { describe, expect, it } from 'vitest'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
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
  it('bounds every component of a key through the installed encoder and decoder', async () => {
    await MeshoptEncoder.ready
    await MeshoptDecoder.ready
    // Keys at every power of two from 2^-25 to 1, three components each,
    // from a fixed linear congruential sequence so every run reads the
    // same keys.
    let state = 1
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
    const count = 50000
    const keys = new Float32Array(count * 3)
    for (let i = 0; i < keys.length; i += 1) {
      keys[i] = (next() * 2 - 1) * Math.pow(2, -Math.floor(next() * 26))
    }
    const stride = 12
    const filtered = MeshoptEncoder.encodeFilterExp(keys, count, stride, KEY_FILTER_BITS)
    const encoded = MeshoptEncoder.encodeGltfBuffer(filtered, count, stride, 'ATTRIBUTES')
    const decodedBytes = new Uint8Array(count * stride)
    MeshoptDecoder.decodeGltfBuffer(
      decodedBytes,
      count,
      stride,
      encoded,
      'ATTRIBUTES',
      'EXPONENTIAL',
    )
    const decoded = new Float32Array(decodedBytes.buffer)
    let worstShare = 0
    for (let key = 0; key < count; key += 1) {
      const components = Array.from(keys.subarray(key * 3, key * 3 + 3))
      const bound = translationKeyComponentBound(components)
      for (let component = 0; component < 3; component += 1) {
        const error = Math.abs((decoded[key * 3 + component] ?? 0) - (components[component] ?? 0))
        expect(error).toBeLessThanOrEqual(bound)
        if (bound > 0) {
          worstShare = Math.max(worstShare, error / bound)
        }
      }
    }
    // The bound is tight: the round trip reaches into its last percent.
    expect(worstShare).toBeGreaterThan(0.99)
  })

  it('is 2 to the minus bits-1 of the largest key component', () => {
    const step = Math.pow(2, 1 - KEY_FILTER_BITS)
    expect(translationKeyComponentBound([1, 0, 0])).toBe(step)
    expect(translationKeyComponentBound([-4, 0.5, 2])).toBe(step * 4)
    expect(translationKeyComponentBound([0, 0, 0])).toBe(0)
  })

  it('refuses an empty key', () => {
    expect(() => translationKeyComponentBound([])).toThrow(/at least one component/)
  })
})
