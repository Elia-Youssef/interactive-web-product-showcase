import { describe, expect, it } from 'vitest'
import { createAppStore, selectProductStatus } from '@store/index'
import { StageOverlay } from '../overlay/StageOverlay'
import { enterProductLife, type ProductLifeOwners } from './productLife'

// The product's life owns the clear of the stage's per-product records:
// the leave takes them off with no feature involved, which is the shape of
// a composition without hotspots.

function owners(): { readonly overlay: StageOverlay; readonly lifeOwners: ProductLifeOwners } {
  const store = createAppStore()
  const overlay = new StageOverlay()
  const { productLoad, productReset } = store.getState()
  return { overlay, lifeOwners: { productLoad, productReset, overlay } }
}

describe('enterProductLife', () => {
  it('takes the overlay records the life left off the channel when it leaves, with no feature mounted', () => {
    const { overlay, lifeOwners } = owners()
    const leave = enterProductLife('a', lifeOwners)
    overlay.place('HS_one', { kind: 'placed', x: 4, y: 8 })
    expect(overlay.placementOf('HS_one')).not.toBeNull()

    leave()

    expect(overlay.placementOf('HS_one')).toBeNull()
    expect(overlay.placementRecord()).toEqual({})
  })

  it('leaves the next life a clean channel and reads only what that life writes', () => {
    const { overlay, lifeOwners } = owners()
    const leaveFirst = enterProductLife('a', lifeOwners)
    overlay.place('HS_shared', { kind: 'placed', x: 1, y: 1 })
    leaveFirst()

    enterProductLife('b', lifeOwners)
    expect(overlay.placementOf('HS_shared')).toBeNull()
    overlay.place('HS_other', { kind: 'hidden' })
    expect(Object.keys(overlay.placementRecord())).toEqual(['HS_other'])
  })

  it('reports the load on enter and the reset on leave to the store', () => {
    const store = createAppStore()
    const { productLoad, productReset } = store.getState()
    const leave = enterProductLife('a', { productLoad, productReset, overlay: new StageOverlay() })
    expect(selectProductStatus(store.getState())).toEqual({ kind: 'loading', slug: 'a' })

    leave()

    expect(selectProductStatus(store.getState())).toEqual({ kind: 'idle' })
  })
})
