import '@styles/global.css'
import type { Product as ProductManifest, ProductCollection } from '@lib/product'
import {
  formatProductPath,
  notFoundDocumentTitle,
  parseRoute,
  productDocumentTitle,
} from '@lib/routing'
import { siteCopy } from '@lib/copy/site'
import { StageAngleReadout, StageZoomControls } from '@features/stage-controls'
import { ProductExplode } from '@features/explode'
import { HotspotMarkers, ProductHotspots } from '@features/hotspots'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { ProductFinishes } from '@features/variants'
import { AppStoreProvider } from '@store/index'
import { Product } from '@viewer/product/Product'
import { Stage } from '@viewer/Stage'
import { useEffect, useState } from 'react'
import { CollectionProvider } from './collection/CollectionProvider'
import { NotFoundScreen } from './collection/NotFoundScreen'
import { AppLayout } from './layout/index'
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
    <ProductRoutePage product={page.product} />
  ) : (
    <NotFoundPage collection={collection} />
  )
}

// A known product's page: the document title names what is shown.
function ProductRoutePage({ product }: { readonly product: ProductManifest }) {
  useDocumentTitle(productDocumentTitle(product, siteCopy.collectionName))
  return <ProductPage product={product} />
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

// The layout with one product's words in its slots and the renderer in its
// stage slot, showing the current product through the product channel. The
// stage chrome's angle slot and controls slot carry the stage controls
// feature, which reads the camera through the store. The finishes, the
// exploded view and the hotspots extend the product on the stage: the
// finishes and the exploded view inside it, the hotspots as the canvas
// child plus the markers in the stage's overlay. The panel's dock is held
// here and handed to the markers, so an open card that docks renders into
// the panel (the sheet on phone), and so is the stage chrome, which a
// floating card keeps clear of.
function ProductPage({ product }: { readonly product: ProductManifest }) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [chrome, setChrome] = useState<HTMLElement | null>(null)
  return (
    <AppLayout
      dockRef={setDock}
      chromeRef={setChrome}
      productIndex={<ProductIndexLabel number={product.number} category={product.category} />}
      panel={<ProductPanel product={product} />}
      stage={
        <Stage
          content={
            // Keyed on the slug by choice: a route change remounts the
            // product and every feature extending it, while the page shell
            // and the renderer stay mounted across the switch. Nothing
            // built for one product can outlive it, and the coming product
            // transitions build on that clean mount.
            <Product key={product.slug} manifest={product}>
              <ProductFinishes />
              <ProductHotspots />
              <ProductExplode />
            </Product>
          }
          overlay={<HotspotMarkers product={product} dock={dock} chrome={chrome} />}
        />
      }
      angleReadout={<StageAngleReadout />}
      stageControls={<StageZoomControls />}
    />
  )
}
