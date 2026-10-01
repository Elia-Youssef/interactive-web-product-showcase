import { useCallback, useEffect, useState } from 'react'
import type { ModelFrame } from '../modelFrame'
import { useStageCameraFit } from '../useStageCameraFit'
import { useStageSettle } from '../stageSettleContext'
import { reportSettledProduct } from './reportSettledProduct'

type ProductPresentationProps = {
  // The measured frame of the loaded model: the fit frames it, and the
  // ready report carries its counts.
  readonly frame: ModelFrame
  // The report the stage settle triggers: it hands the store the ready
  // status with the product's slug, its rig summary and the model counts.
  readonly report: () => void
}

// The stage life of a loaded product: the stage camera frames it, the
// stage's settle chain compiles, presents and records a frame around the
// centered, framed model, and only that settle's resolution reports the
// product ready. The store's ready status therefore means a presented
// product, never one whose render pipelines may still be pending.
//
// Both settles of the life report their failures here: the mount settle of
// the report and the fit's re-settle on a resize. The first one is kept, the
// hook returns it, and the component throws it into the product boundary,
// which turns it into the store's failed status.
export function useProductPresentation({ frame, report }: ProductPresentationProps): Error | null {
  const settleScene = useStageSettle()
  const [failure, setFailure] = useState<Error | null>(null)
  const fail = useCallback((error: Error) => {
    setFailure((first) => first ?? error)
  }, [])

  useStageCameraFit(frame, fail)

  useEffect(() => {
    let cancelled = false
    void reportSettledProduct({
      settle: settleScene(),
      report,
      fail,
      isCancelled: () => cancelled,
    })
    return () => {
      cancelled = true
    }
  }, [settleScene, report, fail])

  return failure
}
