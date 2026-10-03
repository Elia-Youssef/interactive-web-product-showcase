import type { Product as ProductManifest } from '@lib/product'
import { ProductExplode } from '@features/explode'
import { ProductFinishes } from '@features/variants'
import { Product } from '@viewer/product/Product'
import { HarnessFrameFault } from './HarnessFrameFault'
import type { HarnessFrameFault as FrameFault } from './frameFaultQuery'
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
  // The dev-only frame fault of this mount, or null for none.
  readonly frameFault: FrameFault | null
}

// The stage content the dev-only harness shows: the probes the product e2e
// reads, and the product with the features the harness composes onto it. A
// later feature of the harness joins as a child of the product, not as a
// line here.
export function HarnessProductContent({
  manifest,
  mounted,
  frameFault,
}: HarnessProductContentProps) {
  return (
    <>
      <RendererMemoryProbe />
      <StageWarmup />
      {frameFault?.scope === 'stage' && <HarnessFrameFault fault={frameFault} />}
      {manifest !== undefined && mounted && (
        <Product manifest={manifest}>
          <SceneGraphProbe />
          <ProductFinishes />
          <ProductExplode />
          {frameFault?.scope === 'product' && <HarnessFrameFault fault={frameFault} />}
        </Product>
      )}
    </>
  )
}
