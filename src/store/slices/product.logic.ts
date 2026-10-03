import type { ProductFailure, ProductModelCounts, ProductRigSummary } from '@lib/product'

// The product status is a union, not a flag pile: exactly one of these
// shapes holds at any time. The rig summary and the model counts ride with
// the ready status, so the automation hook never recomputes them per access,
// and the typed failure rides with the failed status, so a reader tells the
// kind of failure from its facts, never from a message.
export type ProductStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; slug: string }
  | { kind: 'ready'; slug: string; rig: ProductRigSummary; model: ProductModelCounts }
  | { kind: 'failed'; slug: string; failure: ProductFailure }

export type ProductEvent =
  | { kind: 'load'; slug: string }
  | { kind: 'ready'; slug: string; rig: ProductRigSummary; model: ProductModelCounts }
  | { kind: 'failed'; slug: string; failure: ProductFailure }
  | { kind: 'reset' }

export const initialProductStatus: ProductStatus = { kind: 'idle' }

// Pure transition from (status, event) to the next status. Two rules are
// deliberate, and both mirror what the product component can legitimately
// fire in what order:
//
// - The first failure of a product life is the one worth showing: later
//   ready or failed events cannot overwrite it.
// - A failed status survives the failed product's own teardown (reset),
//   because the teardown is a consequence of the failure: the alert that
//   names the problem outlives the component. A later load, a new product
//   life, is what replaces it.
export function applyProductEvent(status: ProductStatus, event: ProductEvent): ProductStatus {
  switch (event.kind) {
    case 'load':
      return { kind: 'loading', slug: event.slug }
    case 'ready':
      return status.kind === 'failed'
        ? status
        : {
            kind: 'ready',
            slug: event.slug,
            rig: event.rig,
            model: event.model,
          }
    case 'failed':
      return status.kind === 'failed'
        ? status
        : { kind: 'failed', slug: event.slug, failure: event.failure }
    case 'reset':
      return status.kind === 'failed' ? status : initialProductStatus
  }
}
