import '@styles/global.css'
import type { Product as ProductManifest, ProductCollection } from '@lib/product'
import {
  formatProductPath,
  notFoundDocumentTitle,
  parseRoute,
  productDocumentTitle,
} from '@lib/routing'
import { siteCopy } from '@lib/copy/site'
import { AppStoreProvider } from '@store/index'
import { useEffect } from 'react'
import { CollectionProvider } from './collection/CollectionProvider'
import { NotFoundScreen } from './collection/NotFoundScreen'
import { AppLayout } from './layout/index'
import { LiveAnnouncements } from './LiveAnnouncements'
import { ProductPage } from './product-page/ProductPage'
import { navigate, useDocumentTitle, useRoutePath } from './routing'
import { resolveRoutePage } from './routing/routePage.logic'

export type CollectionAppProps = {
  // The raw manifests to validate. The app entry passes the product list;
  // the dev-only invalid-collection page passes a broken fixture list.
  readonly manifests: readonly unknown[]
}

// The one composition of the page for a manifest list: the store, the
// collection loaded once, and the route resolved against it. Both entries
// render this, so the error screen the dev page shows is the app's own,
// not a copy.
export function CollectionApp({ manifests }: CollectionAppProps) {
  return (
    <AppStoreProvider>
      <CollectionProvider manifests={manifests}>
        {(collection) => <RoutedCollection collection={collection} />}
      </CollectionProvider>
    </AppStoreProvider>
  )
}

// The route resolved against the collection, and the page it resolves to
// rendered. The switch on the resolved page kind is the only place where
// the page tree changes shape: a product page and the not-found page
// really are different pages, so a move between them remounts the page
// and its stage. A move inside one kind, the root's replace included,
// renders the same tree, so nothing remounts under a redirect.
function RoutedCollection({ collection }: { readonly collection: ProductCollection }) {
  const route = parseRoute(useRoutePath())

  // The root replaces itself with the first product's path, so back from
  // the first product leaves the site instead of landing on a page that
  // would bounce forward again. While the replace is on its way, the
  // route resolves to the first product's page anyway.
  useEffect(() => {
    if (route.kind === 'root') {
      navigate(formatProductPath(collection.first.slug), { replace: true })
    }
  }, [route.kind, collection])

  const page = resolveRoutePage(route, collection)
  return page.kind === 'product' ? (
    <ProductRoutePage product={page.product} collection={collection} />
  ) : (
    <NotFoundPage collection={collection} />
  )
}

// A known product's page: the document title names what is shown, the
// shell's live region speaks the changes the page itself does not, and the
// page carries the collection its row navigates.
function ProductRoutePage({
  product,
  collection,
}: {
  readonly product: ProductManifest
  readonly collection: ProductCollection
}) {
  useDocumentTitle(productDocumentTitle(product, siteCopy.collectionName))
  return (
    <>
      <LiveAnnouncements product={product} />
      <ProductPage product={product} collection={collection} />
    </>
  )
}

// The not-found page: the app layout keeps the site's frame, the stage
// slot stays empty so no renderer starts, and the title names the state.
function NotFoundPage({ collection }: { readonly collection: ProductCollection }) {
  useDocumentTitle(notFoundDocumentTitle(siteCopy.notFoundHeading, siteCopy.collectionName))
  return (
    <AppLayout
      panel={<NotFoundScreen collectionPath={formatProductPath(collection.first.slug)} />}
    />
  )
}
