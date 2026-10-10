import { expect, test } from 'vitest'
import {
  holdValueKey,
  ignoresActivation,
  rangeValueKeys,
  unavailableAttributes,
} from './unavailable'

// The waiting rule, as data: the announced wait, the activation guard and
// the key hold are the one contract every primitive of the library spreads,
// so the behavior lives here and not per control.

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

// The key hold covers exactly the value keys the module declares, and no
// other key: Tab and Shift+Tab share the one key value, Escape, Enter and
// a letter with them, and each keeps its default, so the focus moves and
// the page's own keys work while the control waits.

function held(key: string): boolean {
  let prevented = false
  const event = { key, preventDefault: () => (prevented = true) }
  holdValueKey(event)
  return prevented
}

test('the hold prevents the default of every declared value key', () => {
  for (const key of rangeValueKeys) {
    expect(held(key), key).toBe(true)
  }
})

test('the hold leaves every other key its default', () => {
  for (const key of ['Tab', 'Escape', 'Enter', 'a']) {
    expect(held(key), key).toBe(false)
  }
})
