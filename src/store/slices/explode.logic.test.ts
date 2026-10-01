import { expect, test } from 'vitest'
import { ExplodeRangeError } from '@lib/explode'
import {
  applyExplodeEvent,
  initialExplodeStatus,
  type ExplodeEvent,
  type ExplodeStatus,
} from './explode.logic'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

function active(product: string, target: number, open: boolean): ExplodeStatus {
  return { kind: 'active', product, target, open }
}

// The transition table as test data, one row per cell, in the shape the
// finish status tests use. `identical` asserts the very same status object,
// for the transitions that must keep the store's identity.
type TransitionCase = {
  name: string
  from: ExplodeStatus
  event: ExplodeEvent
  expected?: ExplodeStatus
  throws?: RegExp
  identical?: boolean
}

const OPEN = active(PRODUCT, 1, true)
const CLOSED = active(PRODUCT, 0, false)
const PART_OPEN = active(PRODUCT, 0.4, true)

const table: TransitionCase[] = [
  {
    name: 'idle + attached(product) becomes active, assembled',
    from: initialExplodeStatus,
    event: { kind: 'attached', product: PRODUCT },
    expected: CLOSED,
  },
  {
    name: 'attached assembled + attached(product) again returns the same status object',
    from: CLOSED,
    event: { kind: 'attached', product: PRODUCT },
    expected: CLOSED,
    identical: true,
  },
  {
    name: 'attached open + attached(product) establishes assembled, whatever the status held',
    from: OPEN,
    event: { kind: 'attached', product: PRODUCT },
    expected: CLOSED,
  },
  {
    name: 'attached mid-way + attached(product) establishes assembled',
    from: PART_OPEN,
    event: { kind: 'attached', product: PRODUCT },
    expected: CLOSED,
  },
  {
    name: 'attached open + detached(product) becomes idle',
    from: OPEN,
    event: { kind: 'detached', product: PRODUCT },
    expected: initialExplodeStatus,
  },
  {
    name: 'idle + detached(product) stays idle',
    from: initialExplodeStatus,
    event: { kind: 'detached', product: PRODUCT },
    expected: initialExplodeStatus,
    identical: true,
  },
  {
    name: 'attached + detached(other product) leaves the status alone',
    from: OPEN,
    event: { kind: 'detached', product: OTHER_PRODUCT },
    expected: OPEN,
    identical: true,
  },
  {
    name: 'attached assembled + toggled(product) opens at the far end',
    from: CLOSED,
    event: { kind: 'toggled', product: PRODUCT },
    expected: OPEN,
  },
  {
    name: 'attached open + toggled(product) closes at the start',
    from: OPEN,
    event: { kind: 'toggled', product: PRODUCT },
    expected: CLOSED,
  },
  {
    name: 'idle + toggled(product) leaves the status alone: no attached view cannot move',
    from: initialExplodeStatus,
    event: { kind: 'toggled', product: PRODUCT },
    expected: initialExplodeStatus,
    identical: true,
  },
  {
    name: 'attached for another product + toggled(product) leaves the status alone',
    from: OPEN,
    event: { kind: 'toggled', product: OTHER_PRODUCT },
    expected: OPEN,
    identical: true,
  },
  {
    name: 'idle + scrubbed(product, 0.4) leaves the status alone',
    from: initialExplodeStatus,
    event: { kind: 'scrubbed', product: PRODUCT, target: 0.4 },
    expected: initialExplodeStatus,
    identical: true,
  },
  {
    name: 'attached + scrubbed(product, 0.4) sets the target, open past zero',
    from: CLOSED,
    event: { kind: 'scrubbed', product: PRODUCT, target: 0.4 },
    expected: PART_OPEN,
  },
  {
    name: 'attached + scrubbed(product, 0) closes the view',
    from: PART_OPEN,
    event: { kind: 'scrubbed', product: PRODUCT, target: 0 },
    expected: CLOSED,
  },
  {
    name: 'attached + scrubbed(product, same target, same open) returns the same status object',
    from: PART_OPEN,
    event: { kind: 'scrubbed', product: PRODUCT, target: 0.4 },
    expected: PART_OPEN,
    identical: true,
  },
  {
    name: 'attached open + scrubbed(other product) leaves the status alone',
    from: OPEN,
    event: { kind: 'scrubbed', product: OTHER_PRODUCT, target: 0.7 },
    expected: OPEN,
    identical: true,
  },
  {
    name: 'scrubbed below the range throws the map error',
    from: initialExplodeStatus,
    event: { kind: 'scrubbed', product: PRODUCT, target: -0.001 },
    throws: /in \[0, 1\]/,
  },
  {
    name: 'scrubbed above the range throws the map error',
    from: initialExplodeStatus,
    event: { kind: 'scrubbed', product: PRODUCT, target: 1.001 },
    throws: /in \[0, 1\]/,
  },
  {
    name: 'a missing scrub target throws the map error',
    from: initialExplodeStatus,
    event: { kind: 'scrubbed', product: PRODUCT, target: Number.NaN },
    throws: /in \[0, 1\]/,
  },
]

test.each(table)('$name', ({ from, event, expected, throws, identical }) => {
  if (throws !== undefined) {
    expect(() => applyExplodeEvent(from, event)).toThrowError(throws)
    return
  }
  if (identical) {
    expect(applyExplodeEvent(from, event)).toBe(expected)
    return
  }
  expect(applyExplodeEvent(from, event)).toEqual(expected)
})

test('a scrub out of range throws the typed error itself', () => {
  expect(() =>
    applyExplodeEvent(initialExplodeStatus, { kind: 'scrubbed', product: PRODUCT, target: 2 }),
  ).toThrowError(ExplodeRangeError)
})

// The pair the paired lifetime rests on: an open view that detaches and
// reattaches comes back assembled, exactly like a fresh presentation.
test('detach after open, then attach, is assembled again', () => {
  const detachedOnce = applyExplodeEvent(OPEN, { kind: 'detached', product: PRODUCT })
  expect(applyExplodeEvent(detachedOnce, { kind: 'attached', product: PRODUCT })).toEqual(CLOSED)
})
