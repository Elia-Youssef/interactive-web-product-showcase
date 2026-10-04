import type { Product as ProductManifest } from '@lib/product'
import { ProductExplode } from '@features/explode'
import { HotspotMarkers, ProductHotspots } from '@features/hotspots'
import { ProductFinishes } from '@features/variants'
import { Product } from '@viewer/product/Product'
import { Stage } from '@viewer/Stage'

export type ProductStageProps = {
  readonly product: ProductManifest
  // The panel's dock, where an open card docks (the sheet on phone).
  readonly dock: HTMLElement | null
  // The stage chrome, which a floating card keeps clear of.
  readonly chrome: HTMLElement | null
}

// The renderer showing one product, and the features that extend it: the
// finishes and the exploded view inside the product, the hotspots as the
// canvas child plus the markers in the stage's overlay.
export function ProductStage({ product, dock, chrome }: ProductStageProps) {
  return (
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
  )
}
