import { expect, test } from 'vitest'
import { ignoresActivation, unavailableAttributes, stopKeyAction } from './unavailable'

// The waiting rule, as data: the announced wait and the activation guard
// are the one contract every primitive of the library spreads, so the
// behavior lives here and not per control.

test('a waiting control announces the wait and carries no native attribute', () => {
  expect(unavailableAttributes(true)).toEqual({ 'aria-disabled': true })
  expect(unavailableAttributes(false)).toEqual({ 'aria-disabled': undefined })
  expect(unavailableAttributes(undefined)).toEqual({ 'aria-disabled': undefined })
})

test('activation is ignored while the control waits, in either waiting way', () => {
  expect(ignoresActivation({ unavailable: true })).toBe(true)
  expect(ignoresActivation({ disabled: true })).toBe(true)
  expect(ignoresActivation({ disabled: true, unavailable: true })).toBe(true)
  expect(ignoresActivation({ disabled: false, unavailable: false })).toBe(false)
  expect(ignoresActivation({})).toBe(false)
})

test('the key hold prevents the key default through the event', () => {
  let prevented = 0
  stopKeyAction({ preventDefault: () => (prevented += 1) })
  expect(prevented).toBe(1)
})
