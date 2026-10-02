import { useCallback, useEffect, useState } from 'react'
import { CAMERA_HOME_ID, type Product } from '@lib/product'
import { asError } from '@lib/errors'
import { buildCameraPlan } from '../camera/productPlan'
import { useStageCamera } from '../camera/StageCameraContext'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import { useStageSettle } from '../stageSettleContext'
import { reportSettledProduct } from './reportSettledProduct'

type ProductPresentationProps = {
  // The parsed rig, whose cameras the product's views come from.
  readonly rig: ProductRig
  // The manifest, whose camera block authors the distance limits.
  readonly manifest: Product
  // The measured frame of the loaded model: the views orbit its centered
  // position, and the ready report carries its counts.
  readonly frame: ModelFrame
  // The report the stage settle triggers: it hands the store the ready
  // status with the product's slug, its rig summary and the model counts.
  readonly report: () => void
}

// The stage life of a loaded product: the stage camera presents the home
// view at once, the stage's settle chain presents the settled state twice
// and records both frames around the centered product, and only that
// settle's resolution reports the product ready. The store's ready status
// therefore means a presented product at its home view, never one whose
// render pipelines may still be pending. Camera rules the authored data
// breaks (limits, lens) fail here, as the rig parse fails a
// contract-breaking model.
//
// Both failure channels of the life report here: the camera plan's broken
// rules and the settle's rejections. The first one is kept, the hook
// returns it, and the component throws it into the product boundary, which
// turns it into the store's failed status.
export function useProductPresentation({
  rig,
  manifest,
  frame,
  report,
}: ProductPresentationProps): Error | null {
  const settleScene = useStageSettle()
  const stageCamera = useStageCamera()
  const [failure, setFailure] = useState<Error | null>(null)
  const fail = useCallback((error: Error) => {
    setFailure((first) => first ?? error)
  }, [])

  useEffect(() => {
    let plan
    try {
      plan = buildCameraPlan(rig, manifest, frame)
    } catch (cause) {
      fail(asError(cause))
      return
    }
    // The home view is on the controls before the settle, so the settled
    // frame is the home view.
    stageCamera.present(plan, CAMERA_HOME_ID)
    return () => {
      stageCamera.release()
    }
  }, [stageCamera, rig, manifest, frame, fail])

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
