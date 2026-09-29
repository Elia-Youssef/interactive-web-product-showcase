import { expect, test } from 'vitest'
import type { ProductRigSummary } from '@lib/product'
import { applyProductEvent, type ProductEvent, type ProductStatus } from './product.logic'

// The transition table as test data: one row per cell, so a change to any
// cell fails exactly its own rows.
type TransitionCase = {
  name: string
  from: ProductStatus
  event: ProductEvent
  expected: ProductStatus
}

const summary: ProductRigSummary = {
  parts: ['PART_base'],
  hotspots: [{ id: 'driver', part: 'PART_base' }],
  cameras: ['CAM_home'],
  clip: { name: 'Explode', durationSeconds: 1 },
  variants: ['sage'],
}

const otherSummary: ProductRigSummary = { ...summary, parts: [] }

const failed = (slug: string, reason: string): ProductStatus => ({ kind: 'failed', slug, reason })

const table: TransitionCase[] = [
  {
    name: 'idle + load(sample) becomes loading(sample)',
    from: { kind: 'idle' },
    event: { kind: 'load', slug: 'sample-one' },
    expected: { kind: 'loading', slug: 'sample-one' },
  },
  {
    name: 'loading + ready(slug, rig) becomes ready',
    from: { kind: 'loading', slug: 'sample-one' },
    event: { kind: 'ready', slug: 'sample-one', rig: summary },
    expected: { kind: 'ready', slug: 'sample-one', rig: summary },
  },
  {
    name: 'loading + failed(slug, reason) becomes failed',
    from: { kind: 'loading', slug: 'sample-one' },
    event: { kind: 'failed', slug: 'sample-one', reason: 'the model is missing' },
    expected: failed('sample-one', 'the model is missing'),
  },
  {
    name: 'loading + reset becomes idle',
    from: { kind: 'loading', slug: 'sample-one' },
    event: { kind: 'reset' },
    expected: { kind: 'idle' },
  },
  {
    name: 'ready + ready(slug, other rig) becomes ready with the new rig',
    from: { kind: 'ready', slug: 'sample-one', rig: summary },
    event: { kind: 'ready', slug: 'sample-one', rig: otherSummary },
    expected: { kind: 'ready', slug: 'sample-one', rig: otherSummary },
  },
  {
    name: 'ready + reset becomes idle',
    from: { kind: 'ready', slug: 'sample-one', rig: summary },
    event: { kind: 'reset' },
    expected: { kind: 'idle' },
  },
  {
    name: 'failed + ready keeps the first failure',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'ready', slug: 'sample-one', rig: summary },
    expected: failed('sample-one', 'first cause'),
  },
  {
    name: 'failed + failed(other reason) keeps the first reason',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'failed', slug: 'sample-one', reason: 'second cause' },
    expected: failed('sample-one', 'first cause'),
  },
  {
    name: 'a failed status survives the reset of its own teardown',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'reset' },
    expected: failed('sample-one', 'first cause'),
  },
  {
    name: 'failed + load(other) starts the new product life loading',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'load', slug: 'sample-two' },
    expected: { kind: 'loading', slug: 'sample-two' },
  },
]

test.each(table)('$name', ({ from, event, expected }) => {
  expect(applyProductEvent(from, event)).toEqual(expected)
})

test('a failed status stays the same object on later ready and reset events', () => {
  const current = failed('sample-one', 'first cause')

  expect(applyProductEvent(current, { kind: 'ready', slug: 'sample-one', rig: summary })).toBe(
    current,
  )
  expect(applyProductEvent(current, { kind: 'reset' })).toBe(current)
})
