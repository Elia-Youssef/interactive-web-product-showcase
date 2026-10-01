import type { Product as ProductManifest } from '@lib/product'
import { ProductFinishes } from '@features/variants'
import { Product } from '@viewer/product/Product'
import { RendererMemoryProbe } from './RendererMemoryProbe'
import { SceneGraphProbe } from './SceneGraphProbe'
import { StageWarmup } from './StageWarmup'

type HarnessProductContentProps = {
  // The manifest the page hands the product, the look override applied.
  readonly manifest: ProductManifest | undefined
  // Whether the product is mounted: the page's toggle unmounts and remounts
  // it under the same stage, so the disposal proof measures the real
  // teardown against this page's own baseline.
  readonly mounted: boolean
}

// The stage content the dev-only harness shows: the probes the product e2e
// reads, and the product with the features the harness composes onto it. A
// later feature of the harness joins as a child of the product, not as a
// line here.
export function HarnessProductContent({ manifest, mounted }: HarnessProductContentProps) {
  return (
    <>
      <RendererMemoryProbe />
      <StageWarmup />
      {manifest !== undefined && mounted && (
        <Product manifest={manifest}>
          <SceneGraphProbe />
          <ProductFinishes />
        </Product>
      )}
    </>
  )
}
