import { useState, type ReactNode } from 'react'
import type { ProductCollection } from '@lib/product'
import { CollectionErrorScreen } from './CollectionErrorScreen'
import { loadCollection } from './collection.logic'

type CollectionProviderProps = {
  // The raw manifests to validate. The app passes the real list; a dev-only
  // harness may pass a broken fixture to reach the error screen.
  manifests: readonly unknown[]
  children: (collection: ProductCollection) => ReactNode
}

// One collection per mount, like the store: the load runs once, in the state
// initializer, and never re-runs while this provider stays mounted. On a
// validation failure it renders the typed error screen in place of the
// children, so the error never crosses this boundary.
export function CollectionProvider({ manifests, children }: CollectionProviderProps) {
  const [result] = useState(() => loadCollection(manifests))

  switch (result.kind) {
    case 'ready':
      return <>{children(result.collection)}</>
    case 'invalid':
      return <CollectionErrorScreen error={result.error} />
  }
}
