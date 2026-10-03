import { use, useCallback, useMemo, type ReactNode } from 'react'
import { productModelUrl, type Product, type ProductFailure } from '@lib/product'
import { useStageHold } from '../stageHoldsContext'
import { useProductModelLoads } from './ProductModelsProvider'
import { ProductFailureReport } from './ProductFailureReport'
import { PresentedProduct } from './PresentedProduct'
import { openProduct } from './productOutcomes'
import { releaseProductModel } from './productModelLoads'

type ProductContentProps = {
  readonly manifest: Product
  // The product's failure channel: every anticipated failure of the load,
  // the rig and the presentation reaches it as a typed value.
  readonly fail: (failure: ProductFailure) => void
  // The product's extensions, mounted once the product is presented.
  readonly children?: ReactNode
}

// The product's model inside the Canvas: it reads the model's load from the
// stage's model loads, suspends until the load has settled, holds the load
// for as long as it renders it, and opens the model against the manifest.
// The load settles as an outcome, never as a rejection, so a model that
// cannot load or breaks the contract reaches the product's channel as a
// typed failure and nothing is thrown into the render. An opened model is
// handed to the presentation.
export function ProductContent({ manifest, fail, children }: ProductContentProps) {
  const models = useProductModelLoads()
  // The load entry is the same object on every render while it is live, so
  // the suspension resumes on the very promise it suspended on.
  const model = models.read(productModelUrl(manifest.slug))
  const load = use(model.value)

  // The load's lifetime is this component's hold on it, a failed load
  // included. Once the hold is gone for good, what the load created is
  // released and the load is forgotten, so the next mount loads fresh
  // instead of reusing a released tree.
  const release = useCallback(() => {
    releaseProductModel(load)
    models.forget(model)
  }, [load, models, model])
  useStageHold(model, release)

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
