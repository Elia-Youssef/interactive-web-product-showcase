import type { Product as ProductManifest, ProductCollection } from '@lib/product'
import { StageAngleReadout, StageZoomControls } from '@features/stage-controls'
import { CollectionNavRow } from '@features/collection'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { useState } from 'react'
import { RouteLink } from '../routing'
import { AppLayout } from '../layout/index'
import { ProductStage } from './ProductStage'
import { useProductSwitch } from './useProductSwitch'

export type ProductPageProps = {
  // The product the route names.
  readonly product: ProductManifest
  readonly collection: ProductCollection
}

// The layout with the shown product's words in its slots and the stage in
// the stage slot. The page lives across product switches: the route's
// product is the switch's target, and the panel and the stage both show the
// product the switch has swapped in, so the words, the finish offer and the
// explode toggle always describe the product on the stage, and they change
// together with it, under the transition's cover. The stage chrome's angle
// slot and controls slot carry the stage controls feature, which reads the
// camera through the store. The panel's dock is held here and handed to the
// stage, so an open card that docks renders into the panel (the sheet on
// phone), and so is the stage chrome, which a floating card keeps clear of.
// The panel's navigation row slot carries the collection feature with the
// app's link handed in, so the row moves through the real collection and
// the feature never reaches the app layer.
export function ProductPage({ product, collection }: ProductPageProps) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [chrome, setChrome] = useState<HTMLElement | null>(null)
  const productSwitch = useProductSwitch(product, collection)
  const shown = productSwitch.shown.manifest
  return (
    <AppLayout
      dockRef={setDock}
      chromeRef={setChrome}
      productIndex={<ProductIndexLabel number={shown.number} category={shown.category} />}
      panel={
        <ProductPanel
          product={shown}
          navigationRow={
            <CollectionNavRow product={shown} collection={collection} link={RouteLink} />
          }
        />
      }
      stage={<ProductStage productSwitch={productSwitch} dock={dock} chrome={chrome} />}
      angleReadout={<StageAngleReadout />}
      stageControls={<StageZoomControls />}
    />
  )
}
