import type { Product as ProductManifest } from '@lib/product'
import { StageAngleReadout, StageZoomControls } from '@features/stage-controls'
import { ProductIndexLabel, ProductPanel } from '@features/product-panel'
import { useState } from 'react'
import { AppLayout } from '../layout/index'
import { ProductStage } from './ProductStage'

// The layout with one product's words in its slots and its stage in the
// stage slot. The stage chrome's angle slot and controls slot carry the
// stage controls feature, which reads the camera through the store. The
// panel's dock is held here and handed to the stage, so an open card that
// docks renders into the panel (the sheet on phone), and so is the stage
// chrome, which a floating card keeps clear of.
export function ProductPage({ product }: { readonly product: ProductManifest }) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [chrome, setChrome] = useState<HTMLElement | null>(null)
  return (
    <AppLayout
      dockRef={setDock}
      chromeRef={setChrome}
      productIndex={<ProductIndexLabel number={product.number} category={product.category} />}
      panel={<ProductPanel product={product} />}
      stage={<ProductStage product={product} dock={dock} chrome={chrome} />}
      angleReadout={<StageAngleReadout />}
      stageControls={<StageZoomControls />}
    />
  )
}
