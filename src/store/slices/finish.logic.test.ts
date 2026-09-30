import { expect, test } from 'vitest'
import {
  applyFinishEvent,
  initialFinishStatus,
  type FinishEvent,
  type FinishStatus,
} from './finish.logic'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'
const VARIANTS = ['midnight', 'beach', 'street']

function offered(
  product: string = PRODUCT,
  variants: readonly string[] = VARIANTS,
  selected?: string,
): FinishStatus {
  const status = applyFinishEvent(initialFinishStatus, { kind: 'offered', product, variants })
  if (status.kind !== 'offered') {
    throw new Error('the offer transition must produce an offered status')
  }
  if (selected === undefined) {
    return status
  }
  return applyFinishEvent(status, { kind: 'selected', product, variant: selected })
}

// The transition table as test data: one row per cell, so a change to any
// cell fails exactly its own rows. `identical` asserts the very same status
// object, for the transitions that must keep the store's identity.
type TransitionCase = {
  name: string
  from: FinishStatus
  event: FinishEvent
  expected?: FinishStatus
  throws?: RegExp
  identical?: boolean
}

const onOffer = offered(PRODUCT, VARIANTS, 'beach')

const table: TransitionCase[] = [
  {
    name: 'idle + offered(product, variants) becomes offered with the first variant selected',
    from: initialFinishStatus,
    event: { kind: 'offered', product: PRODUCT, variants: VARIANTS },
    expected: offered(PRODUCT, VARIANTS, 'midnight'),
  },
  {
    name: 'offered + selected(product, known) becomes offered with that variant',
    from: offered(),
    event: { kind: 'selected', product: PRODUCT, variant: 'street' },
    expected: offered(PRODUCT, VARIANTS, 'street'),
  },
  {
    name: 'offered + reset(product) becomes offered with the first variant again',
    from: offered(PRODUCT, VARIANTS, 'beach'),
    event: { kind: 'reset', product: PRODUCT },
    expected: offered(PRODUCT, VARIANTS, 'midnight'),
  },
  {
    name: 're-offering the product on offer with the same variants returns the same status object',
    from: onOffer,
    event: { kind: 'offered', product: PRODUCT, variants: VARIANTS },
    expected: onOffer,
    identical: true,
  },
  {
    name: 'an offer for another product becomes a new offer at that product default',
    from: offered(PRODUCT, VARIANTS, 'street'),
    event: { kind: 'offered', product: OTHER_PRODUCT, variants: ['sage', 'graphite'] },
    expected: offered(OTHER_PRODUCT, ['sage', 'graphite'], 'sage'),
  },
  {
    name: 're-offering the same product with other variants becomes a new offer at the new default',
    from: offered(PRODUCT, VARIANTS, 'street'),
    event: { kind: 'offered', product: PRODUCT, variants: ['graphite', 'midnight'] },
    expected: offered(PRODUCT, ['graphite', 'midnight'], 'graphite'),
  },
  {
    name: 'idle + reset(product) stays idle',
    from: initialFinishStatus,
    event: { kind: 'reset', product: PRODUCT },
    expected: initialFinishStatus,
  },
  {
    name: 'offered + selected(other product, variant it offers) throws for the other product',
    from: offered(),
    event: { kind: 'selected', product: OTHER_PRODUCT, variant: 'midnight' },
    throws: new RegExp(`'${OTHER_PRODUCT}' is not on offer`),
  },
  {
    name: 'offered + reset(other product) throws for the other product',
    from: offered(),
    event: { kind: 'reset', product: OTHER_PRODUCT },
    throws: new RegExp(`'${OTHER_PRODUCT}' is not on offer`),
  },
  {
    name: 'offered + selected(unknown) throws',
    from: offered(),
    event: { kind: 'selected', product: PRODUCT, variant: 'midnite' },
    throws: /do not include the variant 'midnite'/,
  },
  {
    name: 'idle + selected(product, variant) throws',
    from: initialFinishStatus,
    event: { kind: 'selected', product: PRODUCT, variant: 'midnight' },
    throws: /before a product offers its finishes/,
  },
  {
    name: 'idle + offered(product, empty) throws',
    from: initialFinishStatus,
    event: { kind: 'offered', product: PRODUCT, variants: [] },
    throws: new RegExp(`'${PRODUCT}' needs at least one variant`),
  },
]

test.each(table)('$name', ({ from, event, expected, throws, identical }) => {
  if (throws !== undefined) {
    expect(() => applyFinishEvent(from, event)).toThrowError(throws)
    return
  }
  if (identical) {
    expect(applyFinishEvent(from, event)).toBe(expected)
    return
  }
  expect(applyFinishEvent(from, event)).toEqual(expected)
})

test('re-offering with the same variants in a fresh array returns the same status object', () => {
  const status = offered(PRODUCT, VARIANTS, 'beach')

  // The panel rebuilds the variant array on every offer, so the names and
  // their order decide same, never the array identity.
  expect(
    applyFinishEvent(status, { kind: 'offered', product: PRODUCT, variants: [...VARIANTS] }),
  ).toBe(status)
})

test('selecting the already selected variant returns the same status object', () => {
  const status = offered(PRODUCT, VARIANTS, 'beach')

  expect(applyFinishEvent(status, { kind: 'selected', product: PRODUCT, variant: 'beach' })).toBe(
    status,
  )
})

test('resetting an already default selection returns the same status object', () => {
  const status = offered(PRODUCT, VARIANTS, 'midnight')

  expect(applyFinishEvent(status, { kind: 'reset', product: PRODUCT })).toBe(status)
})

test('resetting an idle status returns the same status object', () => {
  expect(applyFinishEvent(initialFinishStatus, { kind: 'reset', product: PRODUCT })).toBe(
    initialFinishStatus,
  )
})
