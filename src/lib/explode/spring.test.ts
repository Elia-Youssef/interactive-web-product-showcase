import { describe, expect, test } from 'vitest'
import { isSpringAtRest, springSettings, stepSpring } from './spring'

// The settings under test: a full move settles in a second, and the rest
// band is a thousandth of the travel. The feature's config picks the real
// numbers; the math under test is the same.
const SETTINGS = springSettings(1, 0.001)

const AT_ZERO = { value: 0, velocity: 0 }
const AT_ONE = { value: 1, velocity: 0 }

describe('springSettings', () => {
  test('a non-positive settle time fails loudly', () => {
    expect(() => springSettings(0, 0.001)).toThrowError(/settle time/)
    expect(() => springSettings(-1, 0.001)).toThrowError(/settle time/)
  })

  test('a rest threshold outside (0, 1) fails loudly', () => {
    expect(() => springSettings(1, 0)).toThrowError(/rest threshold/)
    expect(() => springSettings(1, 1)).toThrowError(/rest threshold/)
    expect(() => springSettings(1, 1.5)).toThrowError(/rest threshold/)
  })

  test('the rest exponent solves its own equation', () => {
    // The omega the factory derived must make a from-rest full move first
    // enter the band exactly at settleSeconds: the definition the config
    // states. Checked against the closed form, not against a tuned number.
    const gapAtSettle = Math.abs(stepSpring(AT_ZERO, 1, SETTINGS.settleSeconds, SETTINGS).value - 1)
    expect(gapAtSettle).toBeLessThanOrEqual(SETTINGS.restThreshold)
  })

  // The root finder must settle over the whole range the validation
  // accepts, so both ends get a threshold: the property is that the found
  // exponent sits inside the band and that the exponent below it does not,
  // which is the crossing the settle time is derived from.
  test.each([{ restThreshold: 0.999999 }, { restThreshold: 1e-9 }])(
    'the rest exponent settles for a threshold of $restThreshold',
    ({ restThreshold }) => {
      const settings = springSettings(1, restThreshold)
      const u = settings.omegaRadiansPerSecond * settings.settleSeconds
      const atU = (1 + u) * Math.exp(-u)
      const below = (1 + u / 2) * Math.exp(-u / 2)
      expect(atU).toBeLessThanOrEqual(restThreshold)
      expect(below).toBeGreaterThan(restThreshold)
    },
  )
})

describe('frame-rate independence', () => {
  // One 100 ms step against ten 10 ms steps. The closed form is exact per
  // evaluation, so the only difference is float64 rounding of the exp and
  // the polynomial, accumulated over the ten evaluations: tens of ulps near
  // a value of 1, far below the asserted 1e-12.
  test('one 100 ms step lands where ten 10 ms steps land', () => {
    const one = stepSpring(AT_ZERO, 1, 0.1, SETTINGS)
    let ten = { ...AT_ZERO }
    for (let step = 0; step < 10; step += 1) {
      ten = stepSpring(ten, 1, 0.01, SETTINGS)
    }
    expect(Math.abs(one.value - ten.value)).toBeLessThan(1e-12)
    expect(Math.abs(one.velocity - ten.velocity)).toBeLessThan(1e-12)
  })

  test('the same holds on the way down, with velocity carried mid-motion', () => {
    const midway = stepSpring(AT_ONE, 0, 0.3, SETTINGS)
    const one = stepSpring(midway, 0, 0.1, SETTINGS)
    let ten = midway
    for (let step = 0; step < 10; step += 1) {
      ten = stepSpring(ten, 0, 0.01, SETTINGS)
    }
    expect(Math.abs(one.value - ten.value)).toBeLessThan(1e-12)
    expect(Math.abs(one.velocity - ten.velocity)).toBeLessThan(1e-12)
  })
})

describe('no overshoot', () => {
  test.each([
    { name: 'opening from rest', from: AT_ZERO, target: 1 },
    { name: 'closing from rest', from: AT_ONE, target: 0 },
  ])('$name never crosses the target', ({ from, target }) => {
    const low = Math.min(from.value, target)
    const high = Math.max(from.value, target)
    for (let elapsed = 0.005; elapsed <= 5; elapsed *= 1.7) {
      const step = stepSpring(from, target, elapsed, SETTINGS)
      expect(step.value).toBeGreaterThanOrEqual(low)
      expect(step.value).toBeLessThanOrEqual(high)
    }
  })

  test('retargeting mid-motion never crosses the new target', () => {
    const opening = stepSpring(AT_ZERO, 1, 0.25, SETTINGS)
    const closing = stepSpring(opening, 0, 0.25, SETTINGS)
    for (let elapsed = 0.005; elapsed <= 5; elapsed *= 1.7) {
      const step = stepSpring(closing, 0, elapsed, SETTINGS)
      expect(step.value).toBeGreaterThanOrEqual(0)
      expect(step.value).toBeLessThanOrEqual(closing.value)
    }
    // And back out again, mid-close: the same bound toward the far end.
    const reopening = stepSpring(closing, 1, 0.1, SETTINGS)
    for (let elapsed = 0.005; elapsed <= 5; elapsed *= 1.7) {
      const step = stepSpring(reopening, 1, elapsed, SETTINGS)
      expect(step.value).toBeGreaterThanOrEqual(reopening.value)
      expect(step.value).toBeLessThanOrEqual(1)
    }
  })

  test('a scrub across the whole travel keeps the progress inside [0, 1]', () => {
    // The map throws past the ends, so the spring feeding it must never
    // produce a value outside. A scrub chain that reverses mid-motion is
    // the widest case the future control can produce.
    let state = { ...AT_ZERO }
    for (const target of [1, 0, 0.4, 1, 0.2, 0]) {
      state = stepSpring(state, target, 0.07, SETTINGS)
      expect(state.value).toBeGreaterThanOrEqual(0)
      expect(state.value).toBeLessThanOrEqual(1)
    }
  })
})

describe('rest', () => {
  test('entering the band snaps exactly onto the target', () => {
    const step = stepSpring(AT_ZERO, 1, SETTINGS.settleSeconds, SETTINGS)
    expect(step.value).toBe(1)
    expect(step.velocity).toBe(0)
    expect(step.atRest).toBe(true)
    expect(isSpringAtRest(step, 1)).toBe(true)
  })

  test('settleSeconds is the time a full move needs to reach rest', () => {
    // Just before the settle time the move is still running, with its
    // remaining gap at the band's own scale: the decay drops the gap by
    // about u / (1 + u) of itself per unit of u, so the last percent of the
    // settle time sheds roughly a twelfth of the gap, and 1.1x the
    // threshold is the bound that scale gives. At the settle time the move
    // has snapped.
    const before = stepSpring(AT_ZERO, 1, SETTINGS.settleSeconds * 0.99, SETTINGS)
    expect(before.atRest).toBe(false)
    expect(before.value).toBeLessThan(1)
    expect(1 - before.value).toBeLessThanOrEqual(SETTINGS.restThreshold * 1.1)
  })

  test('a state at rest stays at rest and pays no motion', () => {
    const step = stepSpring({ value: 1, velocity: 0 }, 1, 0.5, SETTINGS)
    expect(step).toEqual({ value: 1, velocity: 0, atRest: true })
  })

  test('a zero-length step moves nothing', () => {
    const step = stepSpring(AT_ZERO, 1, 0, SETTINGS)
    expect(step.value).toBe(0)
    expect(step.velocity).toBe(0)
    expect(step.atRest).toBe(false)
  })
})

test('a negative elapsed time is a caller error', () => {
  expect(() => stepSpring(AT_ZERO, 1, -0.001, SETTINGS)).toThrowError(/elapsed/)
  expect(() => stepSpring(AT_ZERO, 1, Number.NaN, SETTINGS)).toThrowError(/elapsed/)
})

test('the step is pure: the state argument is not written', () => {
  const state = { value: 0.2, velocity: 0.3 }
  stepSpring(state, 1, 0.1, SETTINGS)
  expect(state).toEqual({ value: 0.2, velocity: 0.3 })
})
