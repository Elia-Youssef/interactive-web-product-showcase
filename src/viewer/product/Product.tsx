import { Suspense, useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import {
  productModelUrl,
  type Product,
  type ProductFailure,
  type ProductModelCounts,
  type ProductRigSummary,
} from '@lib/product'
import type { ProductSettleOutcome } from '@lib/product-switch'
import { selectProductFailed, useAppStore } from '@store/index'
import { useStageOverlay } from '../overlay/stageOverlayContext'
import { useStageFramePath } from '../stageFrameContext'
import { ProductBoundary } from './ProductBoundary'
import { ProductContent } from './ProductContent'
import { enterProductLife } from './productLife'
import { useProductModel } from './useProductModel'
import { useProductFailureReport } from './useProductFailureReport'

type ProductProps = {
  readonly manifest: Product
  // Told once the stage has settled, with presented or failed content, for the
  // owner that sequences what the stage shows. A life reports to the owner
  // that mounted it, so a report can never be mistaken for another life's.
  readonly onSettled?: (outcome: ProductSettleOutcome) => void
  // The features that extend the loaded product (finishes, hotspots, the
  // exploded view): mounted with it and reading it through
  // useLoadedProduct, so the composition decides which features a product
  // has and the product path stays one.
  readonly children?: ReactNode
}

// The product in the stage: it owns the product's life (the store's load on
// enter; the store's reset and the overlay's per-product records cleared on
// leave) and the product's one failure channel. Every failure of the life
// reaches the store through it as a typed value, a frame that throws under
// its presented content included, and a failed product leaves the stage on
// the store's word: its content stops rendering, so nothing of it is
// presented again and nothing is thrown.
// The content mounts under a Suspense boundary whose fallback is null, as
// there is no branded loader yet, and around it sits the product's own
// error boundary, for programming errors only; it reports them to the same
// channel, so even those fail the product, never the renderer.
export function Product({ manifest, onSettled, children }: ProductProps) {
  const slug = manifest.slug
  const productLoad = useAppStore((state) => state.productLoad)
  const productReady = useAppStore((state) => state.productReady)
  const productReset = useAppStore((state) => state.productReset)
  const productFailed = useAppStore((state) => state.productFailed)
  const failed = useAppStore((state) => selectProductFailed(state, slug))

  const overlay = useStageOverlay()

  useEffect(
    () => enterProductLife(slug, { productLoad, productReset, overlay }),
    [slug, productLoad, productReset, overlay],
  )

  const fail = useCallback(
    (failure: ProductFailure) => {
      productFailed(slug, failure)
    },
    [productFailed, slug],
  )
  const ready = useCallback(
    (rig: ProductRigSummary, model: ProductModelCounts) => {
      productReady(slug, rig, model)
      onSettled?.('ready')
    },
    [productReady, slug, onSettled],
  )
  // A canvas whose renderer is retired never takes new content: the stage
  // replaces it with a fresh canvas once this life has started, and the
  // content mounts there. The retirement is read as subscribed state, so a
  // retirement re-renders the product whatever else it changes.
  const frames = useStageFramePath()
  const retired = useSyncExternalStore(frames.subscribeRetirement, () => frames.isRetired)
  const presentable = !failed && !retired
  // The life's model load, held for as long as this life wants it: the
  // hold starts in the commit that mounts the life, so a load the stage
  // leaves mid-flight is never held by nobody.
  const model = useProductModel(productModelUrl(slug), presentable)
  useProductFailureReport(failed, onSettled)

  return (
    <ProductBoundary fail={fail}>
      {presentable && model !== null && (
        <Suspense fallback={null}>
          <ProductContent manifest={manifest} model={model} fail={fail} ready={ready}>
            {children}
          </ProductContent>
        </Suspense>
      )}
    </ProductBoundary>
  )
}
