import type { ProductStatus } from '@store/index'
import { productFailureDisplay } from './product/failureMessage'
import { StageAlert } from './StageAlert'

// Facts remain in the product channel; this boundary owns their alert
// presentation, with the reason separate from the semantic problem list.
export function ProductAlert({
  status,
}: {
  readonly status: Extract<ProductStatus, { kind: 'failed' }>
}) {
  const display = productFailureDisplay(status.failure)
  return (
    <StageAlert
      testid="product-alert"
      reason={`${status.slug}: ${display.reason}`}
      problems={display.problems}
    />
  )
}
