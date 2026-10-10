import { expect, it } from 'vitest'
import { applyProductSwitchEvent, initialProductSwitch, type ProductSwitchEvent } from './machine'

const stageFailed = (life: number): ProductSwitchEvent => ({ kind: 'stage-failed', life })
const navigate: ProductSwitchEvent = { kind: 'navigated', slug: 'b' }
const covered: ProductSwitchEvent = { kind: 'covered' }
const ready: ProductSwitchEvent = { kind: 'settled', life: 1, outcome: 'ready' }

for (const events of [[], [navigate], [navigate, covered]]) {
  it(`ends a pending shown life once on stage failure after ${events.length} events`, () => {
    const before = events.reduce(applyProductSwitchEvent, initialProductSwitch('a'))
    const after = applyProductSwitchEvent(before, stageFailed(before.shown.life))
    expect(after.shown.outcome).toBe('stage-failed')
    expect(after.phase).toBe(before.phase === 'covered' ? 'revealing' : before.phase)
    expect(after.rested).toBeNull()
    expect(applyProductSwitchEvent(after, stageFailed(before.shown.life))).toBe(after)
    expect(
      applyProductSwitchEvent(after, {
        kind: 'settled',
        life: before.shown.life,
        outcome: 'ready',
      }),
    ).toBe(after)
  })
}

it('keeps a life already ended ready during reveal', () => {
  const before = [navigate, covered, ready].reduce(
    applyProductSwitchEvent,
    initialProductSwitch('a'),
  )
  expect(applyProductSwitchEvent(before, stageFailed(1))).toBe(before)
})

it('rejects a stale stage failure even when the same product is shown again', () => {
  const before = [navigate, covered, { kind: 'navigated', slug: 'a' } as const].reduce(
    applyProductSwitchEvent,
    initialProductSwitch('a'),
  )
  expect(before.shown.life).toBe(2)
  expect(applyProductSwitchEvent(before, stageFailed(0))).toBe(before)
  expect(applyProductSwitchEvent(before, stageFailed(1))).toBe(before)
  expect(applyProductSwitchEvent(before, stageFailed(2)).phase).toBe('revealing')
})

it('ends the next life on navigation on an already failed stage', () => {
  const before = [stageFailed(0), navigate, covered].reduce(
    applyProductSwitchEvent,
    initialProductSwitch('a'),
  )
  expect(before.shown.outcome).toBe('pending')
  const after = applyProductSwitchEvent(before, stageFailed(1))
  expect(after.shown).toEqual({ slug: 'b', life: 1, outcome: 'stage-failed' })
  expect(after.phase).toBe('revealing')
})
