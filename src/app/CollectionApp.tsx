import '@styles/global.css'
import { useState } from 'react'
import type { Product as ProductManifest } from '@lib/product'
import { StageAngleReadout, StageZoomControls } from '@features/stage-controls'
import { HotspotMarkers, ProductHotspots } from '@features/hotspots'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { ProductFinishes } from '@features/variants'
import { AppStoreProvider } from '@store/index'
import { Product } from '@viewer/product/Product'
import { Stage } from '@viewer/Stage'
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

// The layout with one product's words in its slots and the renderer in its
// stage slot, showing the current product through the product channel. The
// stage chrome's angle slot and controls slot carry the stage controls
// feature, which reads the camera through the store. The finishes and the
// hotspots extend the product on the stage: the finishes inside it, the
// hotspots as the canvas child plus the markers in the stage's overlay. The
// current product is the collection's first until routing arrives. The
// panel's dock is held here and handed to the markers, so an open card that
// docks renders into the panel (the sheet on phone), and so is the stage
// chrome, which a floating card keeps clear of.
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
            <Product manifest={product}>
              <ProductFinishes />
              <ProductHotspots />
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
