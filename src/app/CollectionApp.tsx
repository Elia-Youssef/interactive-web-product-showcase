import '@styles/global.css'
import type { Product } from '@lib/product'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { AppStoreProvider } from '@store/index'
import { CollectionProvider } from './collection/CollectionProvider'
import { AppLayout } from './layout/index'

export type CollectionAppProps = {
  // The raw manifests to validate. The app entry passes the product list;
  // the dev-only invalid-collection page passes a broken fixture list.
  readonly manifests: readonly unknown[]
}

// The one composition of the page for a manifest list: the store, the
// collection loaded once, and the layout filled with the current product.
// Both entries render this, so the error screen the dev page shows is the
// app's own, not a copy.
export function CollectionApp({ manifests }: CollectionAppProps) {
  return (
    <AppStoreProvider>
      <CollectionProvider manifests={manifests}>
        {(collection) => <ProductPage product={collection.first} />}
      </CollectionProvider>
    </AppStoreProvider>
  )
}

// The layout with one product's words in its slots. The current product is
// the collection's first until routing arrives.
function ProductPage({ product }: { readonly product: Product }) {
  return (
    <AppLayout
      productIndex={<ProductIndexLabel number={product.number} category={product.category} />}
      panel={<ProductPanel product={product} />}
    />
  )
}
