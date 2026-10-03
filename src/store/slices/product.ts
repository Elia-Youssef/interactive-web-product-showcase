import type { ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'
import {
  applyProductEvent,
  initialProductStatus,
  type ProductEvent,
  type ProductStatus,
} from './product.logic'

export type { ProductStatus } from './product.logic'

export type ProductSliceState = {
  productStatus: ProductStatus
}

export type ProductSlice = ProductSliceState & {
  productLoad: (slug: string) => void
  productReady: (slug: string, rig: ProductRigSummary, model: ProductModelCounts) => void
  productFailed: (slug: string, failure: ProductFailure) => void
  productReset: () => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetProductState = (updater: (state: ProductSliceState) => Partial<ProductSliceState>) => void

export function createProductSlice(set: SetProductState): ProductSlice {
  const apply = (event: ProductEvent) => {
    set((state) => ({ productStatus: applyProductEvent(state.productStatus, event) }))
  }

  return {
    productStatus: initialProductStatus,
    productLoad: (slug) => apply({ kind: 'load', slug }),
    productReady: (slug, rig, model) => apply({ kind: 'ready', slug, rig, model }),
    productFailed: (slug, failure) => apply({ kind: 'failed', slug, failure }),
    productReset: () => apply({ kind: 'reset' }),
  }
}

export function selectProductStatus(state: ProductSliceState): ProductStatus {
  return state.productStatus
}

// Whether the product the store works on is the named one and has failed.
// The product component reads it to stop rendering a failed product, so a
// failed product leaves the stage on the store's word, with no throw.
export function selectProductFailed(state: ProductSliceState, slug: string): boolean {
  const status = state.productStatus
  return status.kind === 'failed' && status.slug === slug
}
