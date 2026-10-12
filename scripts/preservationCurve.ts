import type { PreservationTrack } from './preservationTracks.ts'

export type AnimationCurve = Pick<
  PreservationTrack,
  'path' | 'interpolation' | 'components' | 'times' | 'values'
>

function keyOf(track: AnimationCurve, index: number): number[] {
  const offset =
    track.interpolation === 'CUBICSPLINE'
      ? (index * 3 + 1) * track.components
      : index * track.components
  return track.values.slice(offset, offset + track.components)
}

function cubicSample(track: AnimationCurve, left: number, right: number, alpha: number): number[] {
  const a = keyOf(track, left)
  const b = keyOf(track, right)
  const duration = (track.times[right] ?? 0) - (track.times[left] ?? 0)
  const aTangent = (left * 3 + 2) * track.components
  const bTangent = right * 3 * track.components
  const squared = alpha * alpha
  const cubed = squared * alpha
  const values = a.map(
    (value, index) =>
      (2 * cubed - 3 * squared + 1) * value +
      (cubed - 2 * squared + alpha) * duration * (track.values[aTangent + index] ?? 0) +
      (-2 * cubed + 3 * squared) * (b[index] ?? 0) +
      (cubed - squared) * duration * (track.values[bTangent + index] ?? 0),
  )
  if (track.path !== 'rotation') return values
  const magnitude = Math.hypot(...values)
  return values.map((value) => value / magnitude)
}

export function bracketOf(track: AnimationCurve, time: number, leftLimit: boolean) {
  let right = track.times.findIndex((key) => (leftLimit ? key >= time : key > time))
  if (right === -1) right = track.times.length
  const left = Math.max(0, right - 1)
  right = Math.min(track.times.length - 1, right)
  const start = track.times[left] ?? 0
  const duration = (track.times[right] ?? start) - start
  return { left, right, alpha: duration === 0 ? 0 : (time - start) / duration }
}

function slerp(a: readonly number[], b: readonly number[], alpha: number): number[] {
  let dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0)
  const sign = dot < 0 ? -1 : 1
  dot = Math.min(1, Math.abs(dot))
  if (dot === 1) return [...a]
  const angle = Math.acos(dot)
  const denominator = Math.sin(angle)
  return a.map(
    (value, index) =>
      (value * Math.sin((1 - alpha) * angle) + sign * (b[index] ?? 0) * Math.sin(alpha * angle)) /
      denominator,
  )
}

export function sample(track: AnimationCurve, time: number, leftLimit = false): number[] {
  const { left, right, alpha } = bracketOf(track, time, leftLimit)
  if (track.interpolation === 'CUBICSPLINE') return cubicSample(track, left, right, alpha)
  const a = keyOf(track, left)
  if (track.interpolation === 'STEP' || alpha === 0) return a
  const b = keyOf(track, right)
  if (track.path === 'rotation') return slerp(a, b, alpha)
  return a.map((value, index) => value + ((b[index] ?? 0) - value) * alpha)
}

export function vectorsMatch(
  before: readonly number[],
  after: readonly number[],
  bound: number,
  rotation: boolean,
): boolean {
  const sign =
    rotation && before.reduce((sum, value, index) => sum + value * (after[index] ?? 0), 0) < 0
      ? -1
      : 1
  return (
    before.length === after.length &&
    before.every((value, index) => {
      const output = after[index] ?? NaN
      return (
        Number.isFinite(value) &&
        Number.isFinite(output) &&
        Math.abs(value - output * sign) <= bound
      )
    })
  )
}
