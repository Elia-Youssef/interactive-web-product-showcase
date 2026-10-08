import { expect, test } from 'vitest'
import { ExplodeRangeError } from '@lib/explode'
import { createAppStore } from '../createAppStore'
import {
  selectExplodeAttached,
  selectExplodeViewState,
  selectExplodeReadout,
  selectExplodeTarget,
} from './explode'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

// The explode state on a real store: the slice holds the view's lifetime
// and readout, and the store composes the toggle and the scrub, so the
// tests drive every explode action where the app drives it.
function makeSlice() {
  const store = createAppStore()
  return { slice: store.getState(), read: () => store.getState() }
}

test('a fresh slice holds no view: nothing is attached, every read is closed', () => {
  const { read } = makeSlice()

  expect(selectExplodeAttached(read(), PRODUCT)).toBe(false)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
})

test('attaching presents the product assembled and enables its view', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)

  expect(selectExplodeAttached(read(), PRODUCT)).toBe(true)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
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
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('open')

  slice.explodeToggle(PRODUCT)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
})

// The toggle's action stays defined from a partial scrub, where the view is
// neither open nor assembled: the press completes the open, and the next
// press closes it, so the pressed state the button announces is the state
// its press acts in.
test('a toggle after a partial scrub completes the open, and the next press closes', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeScrub(PRODUCT, 0.4)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('partial')

  slice.explodeToggle(PRODUCT)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(1)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('open')

  slice.explodeToggle(PRODUCT)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
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
  // A partial scrub is neither open nor assembled: the toggle reads mixed.
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('partial')

  slice.explodeScrub(PRODUCT, 0)
  expect(selectExplodeTarget(read(), PRODUCT)).toBe(0)
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
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
  expect(selectExplodeViewState(read(), PRODUCT)).toBe('assembled')
})

test('a detach for another product leaves the view alone', () => {
  const { slice, read } = makeSlice()

  slice.explodeAttach(PRODUCT)
  slice.explodeToggle(PRODUCT)
  slice.explodeDetach(OTHER_PRODUCT)

  expect(selectExplodeTarget(read(), PRODUCT)).toBe(1)
})

// The published applied progress, the display state the chrome's readout
// renders: live with the pose's progress, idle again on the release, and
// null for every product than the one publishing.
test('a fresh slice publishes nothing', () => {
  const { read } = makeSlice()

  expect(selectExplodeReadout(read(), PRODUCT)).toBeNull()
})

test('a live publish carries the product and its applied progress', () => {
  const { slice, read } = makeSlice()

  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })

  expect(selectExplodeReadout(read(), PRODUCT)).toBe(0.42)
})

test('a publish for another product than the one asked about answers null', () => {
  const { slice, read } = makeSlice()

  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })

  expect(selectExplodeReadout(read(), OTHER_PRODUCT)).toBeNull()
})

test('the release returns the publishing product to idle', () => {
  const { slice, read } = makeSlice()

  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })
  slice.explodePublishReadout({ kind: 'idle', product: PRODUCT })

  expect(selectExplodeReadout(read(), PRODUCT)).toBeNull()
})

test('a stale release for another product leaves the live readout alone', () => {
  const { slice, read } = makeSlice()

  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })
  slice.explodePublishReadout({ kind: 'idle', product: OTHER_PRODUCT })

  expect(selectExplodeReadout(read(), PRODUCT)).toBe(0.42)
})

test('a publish of the same progress keeps the readout identity', () => {
  const { slice, read } = makeSlice()

  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })
  const first = read().explodeReadout
  slice.explodePublishReadout({ kind: 'live', product: PRODUCT, progress: 0.42 })

  expect(read().explodeReadout).toBe(first)
})
