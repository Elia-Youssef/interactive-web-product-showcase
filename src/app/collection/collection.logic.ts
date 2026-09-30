import { CollectionError, createCollection, type ProductCollection } from '@lib/product'

// The outcome of the one collection load at app start.
export type CollectionResult =
  { kind: 'ready'; collection: ProductCollection } | { kind: 'invalid'; error: CollectionError }

// Validates the raw manifests once. A CollectionError becomes the typed
// invalid result, so the caller renders the error screen instead of the
// collection; any other error is a defect in the domain code and propagates.
export function loadCollection(manifests: readonly unknown[]): CollectionResult {
  try {
    return { kind: 'ready', collection: createCollection(manifests) }
  } catch (error) {
    if (error instanceof CollectionError) {
      return { kind: 'invalid', error }
    }
    throw error
  }
}
