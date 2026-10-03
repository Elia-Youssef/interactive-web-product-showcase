import { useEffect } from 'react'
import type { ProductFailure } from '@lib/product'

type ProductFailureReportProps = {
  readonly failure: ProductFailure
  // The product's failure channel.
  readonly fail: (failure: ProductFailure) => void
}

// What the product path renders in place of a product whose opening
// failed: nothing in the scene, and one report of the typed failure to the
// product's channel. The report runs in an effect, never during render, so
// the store changes only after the commit that holds the failure.
export function ProductFailureReport({ failure, fail }: ProductFailureReportProps) {
  useEffect(() => {
    fail(failure)
  }, [failure, fail])
  return null
}
