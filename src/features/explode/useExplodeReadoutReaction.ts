import { useCallback } from 'react'
import { useAppStoreApi } from '@store/index'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import type { ExplodeReactionFactory } from './useExplodeReaction'

// The presented view's readout reaction: it publishes the applied progress
// to the store on every applied change, the assembled pose included, so the
// chrome's readout tracks the pose while it moves and at rest. The release
// returns the readout to idle for this product, so a remount publishes
// nothing stale. The publication rides the driver's own subscription; it
// is display state, and nothing drives the scene from it.
export function useExplodeReadoutReaction(): ExplodeReactionFactory {
  const store = useAppStoreApi()
  const loaded = useLoadedProduct()
  const slug = loaded.manifest.slug

  return useCallback(() => {
    return {
      apply(progress) {
        store.getState().explodePublishReadout({ kind: 'live', product: slug, progress })
      },
      release() {
        store.getState().explodePublishReadout({ kind: 'idle', product: slug })
      },
    }
  }, [store, slug])
}
