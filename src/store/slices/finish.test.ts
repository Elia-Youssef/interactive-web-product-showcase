import { expect, test } from 'vitest'
import {
  createFinishSlice,
  selectFinishStatus,
  selectSelectedVariant,
  type FinishSliceState,
} from './finish'
import { initialFinishStatus } from './finish.logic'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: FinishSliceState = { finishStatus: initialFinishStatus }
  const slice = createFinishSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice starts idle with no selected variant', () => {
  const { read } = makeSlice()

  expect(selectFinishStatus(read())).toEqual({ kind: 'idle' })
  expect(selectSelectedVariant(read(), PRODUCT)).toBeNull()
})

test('offering finishes selects the first variant, the product default', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach', 'street'])

  expect(selectSelectedVariant(read(), PRODUCT)).toBe('midnight')
})

test('selecting a known variant moves the selection', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])
  slice.finishSelected(PRODUCT, 'beach')

  expect(selectSelectedVariant(read(), PRODUCT)).toBe('beach')
})

test('selecting an unknown variant fails loudly', () => {
  const { slice } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])

  expect(() => slice.finishSelected(PRODUCT, 'midnite')).toThrowError(/midnite/)
})

test('selecting before an offer fails loudly', () => {
  const { slice } = makeSlice()

  expect(() => slice.finishSelected(PRODUCT, 'midnight')).toThrowError(/before a product offers/)
})

test('acting on a product that is not on offer fails loudly', () => {
  const { slice } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])

  expect(() => slice.finishSelected(OTHER_PRODUCT, 'midnight')).toThrowError(/sample-two/)
  expect(() => slice.finishReset(OTHER_PRODUCT)).toThrowError(/sample-two/)
})

test('the scoped selector answers only the product on offer', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])
  slice.finishSelected(PRODUCT, 'beach')

  expect(selectSelectedVariant(read(), PRODUCT)).toBe('beach')
  expect(selectSelectedVariant(read(), OTHER_PRODUCT)).toBeNull()
})

test('re-offering the same product keeps the selection', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])
  slice.finishSelected(PRODUCT, 'beach')
  slice.finishOffered(PRODUCT, ['midnight', 'beach'])

  expect(selectSelectedVariant(read(), PRODUCT)).toBe('beach')
})

test('a new offer for another product resets the selection to that product default', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])
  slice.finishSelected(PRODUCT, 'beach')
  slice.finishOffered(OTHER_PRODUCT, ['sage', 'graphite'])

  expect(selectSelectedVariant(read(), OTHER_PRODUCT)).toBe('sage')
  expect(selectSelectedVariant(read(), PRODUCT)).toBeNull()
})

test('reset returns the selection to the product default', () => {
  const { slice, read } = makeSlice()

  slice.finishOffered(PRODUCT, ['midnight', 'beach'])
  slice.finishSelected(PRODUCT, 'beach')
  slice.finishReset(PRODUCT)

  expect(selectSelectedVariant(read(), PRODUCT)).toBe('midnight')
})
