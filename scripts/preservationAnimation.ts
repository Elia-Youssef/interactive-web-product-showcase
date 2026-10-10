import type { PreservationTrack } from './preservationTracks.ts'
import { bracketOf, sample, vectorsMatch } from './preservationCurve.ts'
import { translationKeyComponentBound } from './storageBounds.ts'
import { ANIMATION_RESAMPLE_TOLERANCE } from './settings.ts'

function keyBound(track: PreservationTrack, key: readonly number[]): number {
  if (track.path !== 'rotation') return translationKeyComponentBound(key)
  // encoder.ts selects QUATERNION at 16 bits. Three components are stored
  // on a signed Int16 grid scaled by sqrt(2); the largest is reconstructed
  // from unit length and has magnitude at least 1/2. The square difference
  // bounds the reconstructed component without an authored tolerance.
  const step = 1 / (Math.sqrt(2) * 32767)
  const largest = Math.max(...key.map(Math.abs))
  if (largest === 0) return 0
  const squareError = key.reduce((sum, value) => sum + 2 * Math.abs(value) * step + step * step, 0)
  const lower = Math.sqrt(Math.max(0, largest * largest - squareError))
  return Math.max(step, squareError / (largest + lower))
}

function sampleBound(
  before: PreservationTrack,
  after: PreservationTrack,
  time: number,
  leftLimit: boolean,
): number {
  const { left, right, alpha } = bracketOf(after, time, leftLimit)
  const a = keyBound(before, sample(before, after.times[left] ?? 0))
  if (after.interpolation === 'STEP') return a
  const b = keyBound(before, sample(before, after.times[right] ?? 0))
  return a * (1 - alpha) + b * alpha
}

function cubicMatches(before: PreservationTrack, after: PreservationTrack): boolean {
  if (
    JSON.stringify(before.times) !== JSON.stringify(after.times) ||
    before.values.length !== after.values.length
  )
    return false
  for (let offset = 0; offset < before.values.length; offset += before.components) {
    const a = before.values.slice(offset, offset + before.components)
    const b = after.values.slice(offset, offset + after.components)
    if (!vectorsMatch(a, b, keyBound(before, a), before.path === 'rotation')) return false
  }
  return true
}

export function trackMatches(before: PreservationTrack, after: PreservationTrack): boolean {
  if (
    before.interpolation !== after.interpolation ||
    before.components !== after.components ||
    before.times[0] !== after.times[0] ||
    before.times.at(-1) !== after.times.at(-1)
  )
    return false
  if (before.interpolation === 'CUBICSPLINE' && !cubicMatches(before, after)) return false
  // Compare both decoded curves at the union of their knots, including
  // both limits for STEP. The budget accounts only for resampling and
  // the path's storage filter, so thinning may change timing but not binding.
  for (const time of new Set([...before.times, ...after.times])) {
    for (const leftLimit of before.interpolation === 'STEP' ? [false, true] : [false]) {
      if (
        !vectorsMatch(
          sample(before, time, leftLimit),
          sample(after, time, leftLimit),
          ANIMATION_RESAMPLE_TOLERANCE + sampleBound(before, after, time, leftLimit),
          before.path === 'rotation',
        )
      )
        return false
    }
  }
  return true
}
