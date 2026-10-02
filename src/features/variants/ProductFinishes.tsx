import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { selectSelectedVariant, useAppStore } from '@store/index'
import { useStageProbes } from '@viewer/automation/stageProbesContext'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { useStageSettle } from '@viewer/stageSettleContext'
import { createFinishApplier, type FinishApplier } from './finishApplier'

// The finish controller of a loaded product: it owns one applier for the
// product it extends and hands it each new selection. The applier swaps the
// model's mapped meshes to that finish's materials through the stage settle;
// this component is the only code that creates an applier, so it is the only
// code that changes materials for finishes.
//
// The applier is created in a layout effect keyed on the load and disposed
// with it, so a new load gets a fresh applier that precompiles again, and an
// old applier's pending work never lands on a new load. Each selection is
// handed over in a second layout effect, keyed on the load as well as the
// selection, so a fresh applier receives the selection the store already
// holds even when the selection itself did not change.
//
// The same effect registers the stage's finish probe beside the hand-off, so
// the automation reads the applied finish live from the scene's meshes while
// this controller holds the applier, and reads null once it is gone. There
// is no record published beside the meshes: what is applied is read from
// the meshes themselves, plus the selection the applier is moving to.
//
// The hand-off runs in a layout effect, as a child of ProductContent: a
// child's effects run before its parent's, so the first application and its
// settle are queued ahead of the presentation's ready settle, and the frame
// ready reports already carries the selection. The layout phase also paints
// no frame between the mount and the application, so a remount never flashes
// the model's default finish before the stored one.
//
// A failed application, a settle included, reaches the product's typed
// failure the way the presentation reports its own: the error is held here
// and thrown on the next render, into the boundary that owns the product's
// failures.
export function ProductFinishes() {
  const loaded = useLoadedProduct()
  const settleScene = useStageSettle()
  const probes = useStageProbes()
  const selected = useAppStore((state) => selectSelectedVariant(state, loaded.manifest.slug))
  const applier = useRef<FinishApplier | null>(null)
  const [failure, setFailure] = useState<Error | null>(null)
  const fail = useCallback((error: Error) => {
    setFailure((first) => first ?? error)
  }, [])

  useLayoutEffect(() => {
    const created = createFinishApplier({ loaded, settle: settleScene, onFailure: fail })
    applier.current = created
    return () => {
      applier.current = null
      created.dispose()
    }
  }, [loaded, settleScene, fail])

  useLayoutEffect(() => {
    // The offer must exist before any application: without it the
    // controller cannot know which finish the store selected, and applying
    // a default instead would present a product that does not answer the
    // store. A composition that mounts this controller without
    // useFinishOffer is a composition error and fails loudly.
    if (selected === null) {
      fail(
        new Error(
          `the product '${loaded.manifest.slug}' has no finish offer: mount useFinishOffer for it before ProductFinishes`,
        ),
      )
      return
    }
    const current = applier.current
    // The applier is created by the load's effect, which runs before this
    // one in every commit; a missing applier is a broken effect order and
    // fails loudly instead of silently applying nothing.
    if (current === null) {
      fail(new Error(`the finish applier of the product '${loaded.manifest.slug}' is missing`))
      return
    }
    current.apply(selected)
    return probes.register('finish', () => current.readFinish())
  }, [loaded, selected, probes, fail])

  if (failure !== null) {
    throw failure
  }
  return null
}
