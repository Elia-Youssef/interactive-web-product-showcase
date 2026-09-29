import { expect, test } from 'vitest'
import type { ProductRigSummary } from '@lib/product'
import { createProductSlice, selectProductStatus, type ProductSliceState } from './product'

const summary: ProductRigSummary = {
  parts: ['PART_base'],
  hotspots: [],
  cameras: ['CAM_home'],
  clip: { name: 'Explode', durationSeconds: 2 },
  variants: [],
}

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: ProductSliceState = { productStatus: { kind: 'idle' } }
  const slice = createProductSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice starts idle', () => {
  const { read } = makeSlice()

  expect(selectProductStatus(read())).toEqual({ kind: 'idle' })
})

test('a product life goes load, ready and leaves its summary readable', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  expect(selectProductStatus(read())).toEqual({ kind: 'loading', slug: 'sample-one' })

  slice.productReady('sample-one', summary)
  expect(selectProductStatus(read())).toEqual({
    kind: 'ready',
    slug: 'sample-one',
    rig: summary,
  })
})

test('a failed load names the product and the reason', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productFailed('sample-one', 'the model is missing')

  expect(selectProductStatus(read())).toEqual({
    kind: 'failed',
    slug: 'sample-one',
    reason: 'the model is missing',
  })
})

test('a reset after a healthy product is idle, and a next load starts fresh', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productReady('sample-one', summary)
  slice.productReset()
  expect(selectProductStatus(read())).toEqual({ kind: 'idle' })

  slice.productLoad('sample-two')
  expect(selectProductStatus(read())).toEqual({ kind: 'loading', slug: 'sample-two' })
})

test('a failure outlives its own teardown and the next load replaces it', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productFailed('sample-one', 'the model is missing')
  slice.productReset()
  expect(selectProductStatus(read())).toEqual({
    kind: 'failed',
    slug: 'sample-one',
    reason: 'the model is missing',
  })

  slice.productLoad('sample-two')
  expect(selectProductStatus(read())).toEqual({ kind: 'loading', slug: 'sample-two' })
})
