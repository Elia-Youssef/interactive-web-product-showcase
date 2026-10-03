import { expect, test } from 'vitest'
import {
  EXPLODE_T_MAX,
  EXPLODE_T_MIN,
  ExplodeRangeError,
  checkExplodeT,
  explodeClipTime,
} from './clipTime'

test('the progress range is the closed unit interval', () => {
  expect(EXPLODE_T_MIN).toBe(0)
  expect(EXPLODE_T_MAX).toBe(1)
})

test.each([
  { t: 0, durationSeconds: 2.5, expected: 0 },
  { t: 1, durationSeconds: 2.5, expected: 2.5 },
  { t: 0.5, durationSeconds: 2.5, expected: 1.25 },
  { t: 0.25, durationSeconds: 4, expected: 1 },
])(
  'explodeClipTime($t) over $durationSeconds s is $expected s',
  ({ t, durationSeconds, expected }) => {
    expect(explodeClipTime(t, durationSeconds)).toBe(expected)
  },
)

test('t = 1 lands exactly on the last key time, not a step past it', () => {
  // The committed clip's duration: 2.5 s in binary floats is exact, and the
  // multiplication by 1 must not move it, so the end pose samples at its own
  // keyframe.
  const duration = 2.5
  expect(explodeClipTime(1, duration)).toBe(duration)
})

test('a progress below the range fails with the typed error', () => {
  expect(() => explodeClipTime(-0.001, 2.5)).toThrowError(ExplodeRangeError)
  expect(() => explodeClipTime(-0.001, 2.5)).toThrowError(/in \[0, 1\]/)
})

test('a progress above the range fails with the typed error', () => {
  expect(() => explodeClipTime(1.001, 2.5)).toThrowError(ExplodeRangeError)
})

test('a missing progress is an out-of-range one, not a silent pass', () => {
  expect(() => checkExplodeT(Number.NaN)).toThrowError(ExplodeRangeError)
})

test('the ends themselves pass the check', () => {
  expect(checkExplodeT(0)).toBe(0)
  expect(checkExplodeT(1)).toBe(1)
})
