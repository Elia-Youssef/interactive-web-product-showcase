import type { ReactNode } from 'react'
import { useAppStore } from '@store/index'
import { RendererErrorBoundary } from '../RendererErrorBoundary'

type ProductBoundaryProps = {
  readonly slug: string
  readonly children: ReactNode
}

// The product's own failure channel, inside the Canvas: a model that cannot
// load or a rig that breaks the contract unmounts the product here and
// reaches the store as the product's failure. The renderer's status stays
// untouched, because a broken product is never a stage that failed to
// start. The fallback is null: the visible alert is the stage's DOM
// element outside the Canvas.
export function ProductBoundary({ slug, children }: ProductBoundaryProps) {
  const productFailed = useAppStore((state) => state.productFailed)

  return (
    <RendererErrorBoundary
      onError={(error) => productFailed(slug, error.message)}
      fallback={() => null}
    >
      {children}
    </RendererErrorBoundary>
  )
}
