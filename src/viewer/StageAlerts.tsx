import type { ProductStatus, RendererStatus } from '@store/index'
import { StageAlert } from './StageAlert'
import { ProductAlert } from './ProductAlert'

// Both failure channels can stand together: a renderer failure must not
// erase the product failure that was already being shown.
export function StageAlerts({
  rendererStatus,
  productStatus,
}: {
  readonly rendererStatus: RendererStatus
  readonly productStatus: ProductStatus
}) {
  return (
    <>
      {rendererStatus.kind === 'failed' && <StageAlert reason={rendererStatus.reason} />}
      {productStatus.kind === 'failed' && <ProductAlert status={productStatus} />}
    </>
  )
}
