import { expect, test } from 'vitest'
import type { ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'
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

const counts: ProductModelCounts = { meshes: 4, triangles: 1200 }

const otherSummary: ProductRigSummary = { ...summary, parts: [] }

// A failure value per cause name, so the rows read which failure is kept.
const failure = (message: string): ProductFailure => ({ kind: 'render', message })

const failed = (slug: string, cause: string): ProductStatus => ({
  kind: 'failed',
  slug,
  failure: failure(cause),
})

const ready = (slug: string): ProductStatus => ({
  kind: 'ready',
  slug,
  rig: summary,
  model: counts,
})

const table: TransitionCase[] = [
  {
    name: 'idle + load(sample) becomes loading(sample)',
    from: { kind: 'idle' },
    event: { kind: 'load', slug: 'sample-one' },
    expected: { kind: 'loading', slug: 'sample-one' },
  },
  {
    name: 'loading + ready(slug, rig, model) becomes ready',
    from: { kind: 'loading', slug: 'sample-one' },
    event: { kind: 'ready', slug: 'sample-one', rig: summary, model: counts },
    expected: ready('sample-one'),
  },
  {
    name: 'loading + failed(slug, failure) becomes failed',
    from: { kind: 'loading', slug: 'sample-one' },
    event: { kind: 'failed', slug: 'sample-one', failure: failure('the model is missing') },
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
    from: ready('sample-one'),
    event: {
      kind: 'ready',
      slug: 'sample-one',
      rig: otherSummary,
      model: counts,
    },
    expected: { kind: 'ready', slug: 'sample-one', rig: otherSummary, model: counts },
  },
  {
    name: 'ready + reset becomes idle',
    from: ready('sample-one'),
    event: { kind: 'reset' },
    expected: { kind: 'idle' },
  },
  {
    name: 'failed + ready keeps the first failure',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'ready', slug: 'sample-one', rig: summary, model: counts },
    expected: failed('sample-one', 'first cause'),
  },
  {
    name: 'failed + failed(other failure) keeps the first failure',
    from: failed('sample-one', 'first cause'),
    event: { kind: 'failed', slug: 'sample-one', failure: failure('second cause') },
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

  expect(
    applyProductEvent(current, { kind: 'ready', slug: 'sample-one', rig: summary, model: counts }),
  ).toBe(current)
  expect(applyProductEvent(current, { kind: 'reset' })).toBe(current)
})
