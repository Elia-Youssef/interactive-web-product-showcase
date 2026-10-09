import { useEffect } from 'react'
import type { ProductSettleOutcome } from '@lib/product-switch'
import { useStageSettle } from '../stageSettleContext'
import { reportSettledProduct } from './reportSettledProduct'

// The store fails at once, removing the content in this commit. Only
// then settle the empty stage, behind the previous product's leave, so
// even a life that never mounted content reports on recorded frames.
export function useProductFailureReport(
  failed: boolean,
  onSettled: ((outcome: ProductSettleOutcome) => void) | undefined,
): void {
  const settleScene = useStageSettle()
  useEffect(() => {
    if (!failed) {
      return
    }
    let cancelled = false
    void reportSettledProduct({
      outcome: 'failed',
      settle: settleScene(),
      report: () => onSettled?.('failed'),
      isCancelled: () => cancelled,
    })
    return () => {
      cancelled = true
    }
  }, [failed, settleScene, onSettled])
}
