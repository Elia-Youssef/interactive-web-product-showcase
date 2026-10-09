import { use, useMemo, type ReactNode } from 'react'
import type { Product, ProductFailure } from '@lib/product'
import { ProductFailureReport } from './ProductFailureReport'
import { PresentedProduct } from './PresentedProduct'
import { openProduct } from './productOutcomes'
import type { ProductModelEntry } from './productModelLoads'

type ProductContentProps = {
  readonly manifest: Product
  // The model load the product holds for this life.
  readonly model: ProductModelEntry
  // The product's failure channel: every anticipated failure of the load,
  // the rig and the presentation reaches it as a typed value.
  readonly fail: (failure: ProductFailure) => void
  // The product's extensions, mounted once the product is presented.
  readonly children?: ReactNode
}

// The product's model inside the Canvas: it suspends until the load the
// product holds has settled, and opens the model against the manifest. The
// load settles as an outcome, never as a rejection, so a model that cannot
// load or breaks the contract reaches the product's channel as a typed
// failure and nothing is thrown into the render. An opened model is
// handed to the presentation.
export function ProductContent({ manifest, model, fail, children }: ProductContentProps) {
  // The held entry is the same object on every render while it is live, so
  // the suspension resumes on the very promise it suspended on.
  const load = use(model.value)

  const opened = useMemo(() => openProduct(load, manifest), [load, manifest])
  if (opened.kind === 'failed') {
    return <ProductFailureReport failure={opened.failure} fail={fail} />
  }
  return (
    <PresentedProduct
      manifest={manifest}
      model={opened.model}
      rig={opened.rig}
      finishes={opened.finishes}
      fail={fail}
    >
      {children}
    </PresentedProduct>
  )
}
