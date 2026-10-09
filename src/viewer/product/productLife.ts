import type { AppState } from '@store/index'
import type { StageOverlay } from '../overlay/StageOverlay'

// What a product's life on the stage owns outside its own subtree: the
// store's product status and the overlay channel's per-product records.
// Both live as long as the stage, across the products that swap on it.
export type ProductLifeOwners = {
  readonly productLoad: AppState['productLoad']
  readonly productReset: AppState['productReset']
  readonly overlay: Pick<StageOverlay, 'clearProductState'>
}

// Enters the life of the product on the stage and returns its leave. The
// leave takes everything the life left in the stage's owners off them:
// the store's status goes back to empty, and the overlay's per-product
// records go whole, whichever feature wrote them. The life owns the clear,
// not a feature, so a composition that mounts no hotspots, or a feature
// added later, never leaves a record behind for the next product.
export function enterProductLife(slug: string, owners: ProductLifeOwners): () => void {
  owners.productLoad(slug)
  return () => {
    owners.overlay.clearProductState()
    owners.productReset()
  }
}
