import { expect, test } from 'vitest'
import { ExplodeRangeError } from '@lib/explode'
import {
  createExplodeSlice,
  selectExplodeAttached,
  selectExplodeOpen,
  selectExplodeTarget,
  type ExplodeSliceState,
} from './explode'
import { initialExplodeStatus } from './explode.logic'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: ExplodeSliceState = { explodeStatus: initialExplodeStatus }
  const slice = createExplodeSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice holds no view: nothing is attached, every read is closed', () => {
  const { read } = makeSlice()

  expect(selectExplodeAttached(read(), PRODUCT)).toBe(false)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(false)
})

test('attaching presents the product assembled and enables its view', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)

  expect(selectExplodeAttached(read(), PRODUCT)).toBe(true)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(false)
})

test('only the attached product reads as attached', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)

  expect(selectExplodeAttached(read(), OTHER_PRODUCT)).toBe(false)
})

test('toggling opens and closes the attached view', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(PRODUCT)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(1)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(true)

  slice.explodeToggle(PRODUCT)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(false)
})

test('a toggle with no attached view moves nothing', () => {
  const { slice, read } = makeSlice()

  slice.explodeToggle(PRODUCT)

  expect(selectExplodeAttached(read(), PRODUCT)).toBe(false)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
})

test('a toggle for another product than the attached one moves nothing', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(OTHER_PRODUCT)

  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeTarget(read(), OTHER_PRODUCT)).toBe(0)
})

test('a scrub sets any target in the range for the attached view', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeScrub(PRODUCT, 0.4)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0.4)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(true)

  slice.explodeScrub(PRODUCT, 0)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(false)
})

test('a scrub with no attached view moves nothing', () => {
  const { slice, read } = makeSlice()

  slice.explodeScrub(PRODUCT, 0.4)

  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
})

test('a scrub out of range fails loudly and moves nothing', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(PRODUCT)

  expect(() => slice.explodeScrub(PRODUCT, 1.001)).toThrowError(ExplodeRangeError)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(1)
})

test('detaching drops the view: the next attach presents assembled again', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(PRODUCT)
  slice.explodeDetach(PRODUCT)
  expect(selectExplodeAttached(read(), PRODUCT)).toBe(false)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)

  slice.explodeAttach(PRODUCT)
  expect(selectExplodeAttached(read(), PRODUCT)).toBe(true)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeOpen(read(), PRODUCT)).toBe(false)
})

test('a detach for another product leaves the view alone', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(PRODUCT)
  slice.explodeDetach(OTHER_PRODUCT)

  expect(selectExplodeTarget(read(), PRODUCT)).toBe(1)
})
