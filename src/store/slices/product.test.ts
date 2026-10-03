import { expect, test } from 'vitest'
import type { ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'
import {
  createProductSlice,
  selectProductFailed,
  selectProductStatus,
  type ProductSliceState,
} from './product'

const summary: ProductRigSummary = {
  parts: ['PART_base'],
  hotspots: [],
  cameras: ['CAM_home'],
  clip: { name: 'Explode', durationSeconds: 2 },
  variants: [],
}

const counts: ProductModelCounts = { meshes: 4, triangles: 1200 }

const missingModel: ProductFailure = {
  kind: 'load',
  url: '/models/sample-one/model.glb',
  message: 'the model is missing',
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

  slice.productReady('sample-one', summary, counts)
  expect(selectProductStatus(read())).toEqual({
    kind: 'ready',
    slug: 'sample-one',
    rig: summary,
    model: counts,
  })
})

test('a failed load names the product and carries the typed failure', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productFailed('sample-one', missingModel)

  expect(selectProductStatus(read())).toEqual({
    kind: 'failed',
    slug: 'sample-one',
    failure: missingModel,
  })
})

test('the failed selector names exactly the failed product', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  expect(selectProductFailed(read(), 'sample-one')).toBe(false)

  slice.productFailed('sample-one', missingModel)
  expect(selectProductFailed(read(), 'sample-one')).toBe(true)
  expect(selectProductFailed(read(), 'sample-two')).toBe(false)

  slice.productLoad('sample-one')
  expect(selectProductFailed(read(), 'sample-one')).toBe(false)
})

test('a reset after a healthy product is idle, and a next load starts fresh', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productReady('sample-one', summary, counts)
  slice.productReset()
  expect(selectProductStatus(read())).toEqual({ kind: 'idle' })

  slice.productLoad('sample-two')
  expect(selectProductStatus(read())).toEqual({ kind: 'loading', slug: 'sample-two' })
})

test('a failure outlives its own teardown and the next load replaces it', () => {
  const { slice, read } = makeSlice()

  slice.productLoad('sample-one')
  slice.productFailed('sample-one', missingModel)
  slice.productReset()
  expect(selectProductStatus(read())).toEqual({
    kind: 'failed',
    slug: 'sample-one',
    failure: missingModel,
  })

  slice.productLoad('sample-two')
  expect(selectProductStatus(read())).toEqual({ kind: 'loading', slug: 'sample-two' })
})
