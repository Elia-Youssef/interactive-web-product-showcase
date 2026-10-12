import type { ReactNode } from 'react'
import type { ProductFailure } from '@lib/product'
import { RendererErrorBoundary } from '../RendererErrorBoundary'

type ProductBoundaryProps = {
  // The product's failure channel.
  readonly fail: (failure: ProductFailure) => void
  readonly children: ReactNode
}

// The product's boundary for the unexpected, inside the Canvas. Every
// failure the product path anticipates reaches the product's channel as a
// value and never as a throw, so what lands here is a programming error: it
// unmounts the product and reaches the same channel as the unexpected kind.
// R3F's root also reports it as a page error, next to the channel: its
// createRoot hard-codes reportError for the errors a boundary catches and
// offers the app no hook, and a programming error is right to be loud.
// The renderer's status stays untouched, because a broken product is never
// a stage that failed to start. The fallback is null: the visible alert is
// the stage's DOM element outside the Canvas.
export function ProductBoundary({ fail, children }: ProductBoundaryProps) {
  return (
    <RendererErrorBoundary
      onError={(error) => fail({ kind: 'unexpected', message: error.message })}
      fallback={() => null}
    >
      {children}
    </RendererErrorBoundary>
  )
}
