import { Suspense, useEffect } from 'react'
import type { Product } from '@lib/product'
import { useAppStore } from '@store/index'
import { ProductBoundary } from './ProductBoundary'
import { ProductContent } from './ProductContent'

type ProductProps = {
  readonly manifest: Product
}

// The product in the stage: it reports the product's life to the store
// (load on enter, reset on leave) and mounts the loaded content under a
// Suspense boundary whose fallback is null, as there is no branded
// loader yet. Around the content sits the product's own error boundary, so a
// load failure or a rig that breaks the contract fails the product, never
// the renderer.
export function Product({ manifest }: ProductProps) {
  const slug = manifest.slug
  const productLoad = useAppStore((state) => state.productLoad)
  const productReset = useAppStore((state) => state.productReset)

  useEffect(() => {
    productLoad(slug)
    return () => productReset()
  }, [slug, productLoad, productReset])

  return (
    <ProductBoundary slug={slug}>
      <Suspense fallback={null}>
        <ProductContent manifest={manifest} />
      </Suspense>
    </ProductBoundary>
  )
}
