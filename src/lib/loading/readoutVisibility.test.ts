import { describe, expect, it } from 'vitest'
import type { ProductTransitionPhase } from '../transition/contract'
import { loadReadoutWanted } from './readoutVisibility'

// The readout's visibility rule as a literal table: every phase, every
// renderer kind and every product kind with the verdict written beside it,
// so a new kind fails the rule's switch and this table's shape together.
// Wanted only at an idle phase, on a stage that has not failed, while no
// product is presented; hidden in every other state.

const rendererKinds = ['initializing', 'ready', 'failed'] as const
const productKinds = ['idle', 'loading', 'ready', 'failed'] as const
const phases = ['idle', 'covering', 'covered', 'revealing'] as const

// The table, one verdict per (phase, renderer, product) triple.
const verdicts = {
  idle: {
    initializing: { idle: true, loading: true, ready: false, failed: false },
    ready: { idle: true, loading: true, ready: false, failed: false },
    failed: { idle: false, loading: false, ready: false, failed: false },
  },
  covering: {
    initializing: { idle: false, loading: false, ready: false, failed: false },
    ready: { idle: false, loading: false, ready: false, failed: false },
    failed: { idle: false, loading: false, ready: false, failed: false },
  },
  covered: {
    initializing: { idle: false, loading: false, ready: false, failed: false },
    ready: { idle: false, loading: false, ready: false, failed: false },
    failed: { idle: false, loading: false, ready: false, failed: false },
  },
  revealing: {
    initializing: { idle: false, loading: false, ready: false, failed: false },
    ready: { idle: false, loading: false, ready: false, failed: false },
    failed: { idle: false, loading: false, ready: false, failed: false },
  },
} as const satisfies Record<
  ProductTransitionPhase,
  Record<(typeof rendererKinds)[number], Record<(typeof productKinds)[number], boolean>>
>

describe('loadReadoutWanted', () => {
  it('answers the whole table', () => {
    for (const phase of phases) {
      for (const renderer of rendererKinds) {
        for (const product of productKinds) {
          expect(
            loadReadoutWanted({ renderer, product, phase }),
            `${phase} phase, ${renderer} renderer, ${product} product`,
          ).toBe(verdicts[phase][renderer][product])
        }
      }
    }
  })
})
