import { expect, test } from 'vitest'
import {
  createHotspotSlice,
  selectHotspotStatus,
  selectSelectedHotspot,
  type HotspotSliceState,
} from './hotspot'
import { initialHotspotStatus } from './hotspot.logic'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

// A minimal set wired by hand, so the slice is tested on its own, without
// the composition around it.
function makeSlice() {
  let state: HotspotSliceState = { hotspotStatus: initialHotspotStatus }
  const slice = createHotspotSlice((updater) => {
    state = { ...state, ...updater(state) }
  })

  return { slice, read: () => state }
}

test('a fresh slice starts idle with no selected hotspot', () => {
  const { read } = makeSlice()

  expect(selectHotspotStatus(read())).toEqual({ kind: 'idle' })
  expect(selectSelectedHotspot(read(), PRODUCT)).toBeNull()
})

test('pressing a marker selects it as the one active hotspot', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')

  expect(selectSelectedHotspot(read(), PRODUCT)).toBe('driver')
})

test('pressing the active marker clears the selection', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')
  slice.hotspotToggled(PRODUCT, 'driver')

  expect(selectSelectedHotspot(read(), PRODUCT)).toBeNull()
})

test('pressing another marker moves the one selection: one active hotspot at a time', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')
  slice.hotspotToggled(PRODUCT, 'knob')

  expect(selectSelectedHotspot(read(), PRODUCT)).toBe('knob')
})

test('the scoped selector answers only the product that holds the selection', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')

  expect(selectSelectedHotspot(read(), PRODUCT)).toBe('driver')
  expect(selectSelectedHotspot(read(), OTHER_PRODUCT)).toBeNull()
})

test('a press for another product replaces the selection, which the old product can no longer read', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')
  slice.hotspotToggled(OTHER_PRODUCT, 'knob')

  expect(selectSelectedHotspot(read(), OTHER_PRODUCT)).toBe('knob')
  expect(selectSelectedHotspot(read(), PRODUCT)).toBeNull()
})

test('clearing returns the product to no selection', () => {
  const { slice, read } = makeSlice()

  slice.hotspotToggled(PRODUCT, 'driver')
  slice.hotspotCleared(PRODUCT)

  expect(selectSelectedHotspot(read(), PRODUCT)).toBeNull()
})
