import { useEffect } from 'react'
import type { PendingGate } from '@lib/async/pendingGate'
import { CAMERA_HOME_ID, type Product, type ProductFailure } from '@lib/product'
import { asError } from '@lib/errors'
import { useStageCamera } from '../camera/StageCameraContext'
import type { ModelFrame } from '../modelFrame'
import type { ProductRig } from '../rig/productRig'
import { useStageSettle } from '../stageSettleContext'
import { planPresentation } from './productOutcomes'
import { settleWhenReady } from './productReadyGate'
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
  // The product's failure channel.
  readonly fail: (failure: ProductFailure) => void
  // The product's ready gate: the extensions' first work the ready settle
  // waits for.
  readonly readyGate: PendingGate
}

// The stage life of a loaded product: the stage camera presents the home
// view at once, the ready settle waits for the extensions' first work held
// on the product's ready gate (the first finish and its precompile), the
// stage's settle chain then presents the settled state twice and records
// both frames around the centered product, and only that settle's
// resolution reports the product ready. The store's ready status
// therefore means a presented product at its home view, never one whose
// render pipelines may still be pending.
//
// The leave settles as well: the stage presents itself without the product
// in the frames after it leaves.
//
// Both anticipated failures of the life reach the product's channel as
// typed values: the camera rules the authored data breaks, with every
// problem the plan computed, and a settle that rejects. Neither is thrown,
// so neither reaches the render.
export function useProductPresentation({
  rig,
  manifest,
  frame,
  report,
  fail,
  readyGate,
}: ProductPresentationProps): void {
  const settleScene = useStageSettle()
  const stageCamera = useStageCamera()

  useEffect(() => {
    const presentation = planPresentation(rig, manifest, frame)
    if (presentation.kind === 'failed') {
      fail(presentation.failure)
      return
    }
    // The home view is on the controls before the settle, so the settled
    // frame is the home view.
    stageCamera.present(presentation.plan, CAMERA_HOME_ID)
    return () => {
      stageCamera.release()
    }
  }, [stageCamera, rig, manifest, frame, fail])

  useEffect(() => {
    let cancelled = false
    const isCancelled = (): boolean => cancelled
    void reportSettledProduct({
      outcome: 'ready',
      settle: settleWhenReady({ gate: readyGate, settle: settleScene, isCancelled }),
      report,
      fail,
      isCancelled,
    })
    return () => {
      cancelled = true
    }
  }, [settleScene, report, fail, readyGate])

  // The product leaving the stage is a scene mutation like any other, so
  // its leave settles too: the stage presents itself without the product.
  // Without that present the canvas keeps showing a product whose
  // resources were released, and the engine's frame loop keeps the list of
  // frame callbacks it ran last, the product's own among them, which holds
  // the whole released product reachable until some later frame renders.
  useEffect(
    () => () => {
      // Leave has no outcome to report, but a terminal frame supply must
      // still end its wait and keep the settle's rejection loud.
      void settleScene().catch((cause: unknown) => console.error(asError(cause)))
    },
    [settleScene],
  )
}
