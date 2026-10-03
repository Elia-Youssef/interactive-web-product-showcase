import { Suspense, useCallback, useEffect, type ReactNode } from 'react'
import type { Product, ProductFailure } from '@lib/product'
import { selectProductFailed, useAppStore } from '@store/index'
import { ProductBoundary } from './ProductBoundary'
import { ProductContent } from './ProductContent'

type ProductProps = {
  readonly manifest: Product
  // The features that extend the loaded product (finishes, hotspots, the
  // exploded view): mounted with it and reading it through
  // useLoadedProduct, so the composition decides which features a product
  // has and the product path stays one.
  readonly children?: ReactNode
}

// The product in the stage: it reports the product's life to the store
// (load on enter, reset on leave) and owns the product's one failure
// channel. Every failure of the life reaches the store through it as a
// typed value, and a failed product leaves the stage on the store's word:
// its content stops rendering, so nothing of it is presented again and
// nothing is thrown. The content mounts under a Suspense boundary whose
// fallback is null, as there is no branded loader yet, and around it sits
// the product's own error boundary, for programming errors only; it reports
// them to the same channel, so even those fail the product, never the
// renderer.
export function Product({ manifest, children }: ProductProps) {
  const slug = manifest.slug
  const productLoad = useAppStore((state) => state.productLoad)
  const productReset = useAppStore((state) => state.productReset)
  const productFailed = useAppStore((state) => state.productFailed)
  const failed = useAppStore((state) => selectProductFailed(state, slug))

  useEffect(() => {
    productLoad(slug)
    return () => productReset()
  }, [slug, productLoad, productReset])

  const fail = useCallback(
    (failure: ProductFailure) => productFailed(slug, failure),
    [productFailed, slug],
  )

  return (
    <ProductBoundary fail={fail}>
      {!failed && (
        <Suspense fallback={null}>
          <ProductContent manifest={manifest} fail={fail}>
            {children}
          </ProductContent>
        </Suspense>
      )}
    </ProductBoundary>
  )
}
