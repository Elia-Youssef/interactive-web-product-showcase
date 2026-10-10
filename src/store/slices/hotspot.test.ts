import { expect, test } from 'vitest'
import { createHotspotSlice, selectHotspotSelection, selectSelectedHotspot } from './hotspot'

const PRODUCT = 'sample-one'
const OTHER_PRODUCT = 'sample-two'

// The slice holds the flow's status; its writes are the store's composed
// flow actions (hotspotFlowActions.test.ts). Its selectors name the product
// they ask for.

test('a fresh slice starts idle with no selected hotspot', () => {
  const state = createHotspotSlice()

  expect(state.hotspotStatus).toEqual({ kind: 'idle' })
  expect(selectSelectedHotspot(state, PRODUCT)).toBeNull()
})

test('the selected hotspot is read for the product the selection belongs to only', () => {
  const state = {
    hotspotStatus: {
      kind: 'selected',
      product: PRODUCT,
      hotspot: 'driver',
      closeUp: true,
      origin: 'list',
    },
  } as const

  expect(selectSelectedHotspot(state, PRODUCT)).toBe('driver')
  expect(selectSelectedHotspot(state, OTHER_PRODUCT)).toBeNull()
  expect(selectHotspotSelection(state, PRODUCT)).toBe(state.hotspotStatus)
  expect(selectHotspotSelection(state, OTHER_PRODUCT)).toBeNull()
})
