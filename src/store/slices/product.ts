import type { ProductRigSummary } from '@lib/product'
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
  productReady: (slug: string, rig: ProductRigSummary) => void
  productFailed: (slug: string, reason: string) => void
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
    productReady: (slug, rig) => apply({ kind: 'ready', slug, rig }),
    productFailed: (slug, reason) => apply({ kind: 'failed', slug, reason }),
    productReset: () => apply({ kind: 'reset' }),
  }
}

export function selectProductStatus(state: ProductSliceState): ProductStatus {
  return state.productStatus
}
