import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { asError } from '@lib/errors'
import { selectSelectedVariant, useAppStore } from '@store/index'
import { publishViewerFinish, type ViewerFinish } from '@viewer/automation/viewerAutomation'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { useStageSettle } from '@viewer/stageSettleContext'
import { applyFinish } from './applyFinish'
import { applyFirstFinish } from './firstFinishApplication'

// The finish controller of a loaded product: it reads the store's selected
// variant for the product it extends, swaps the model's mapped meshes to
// that finish's materials through the stage settle, and publishes the
// applied finish for the automation contract. It is the only code that
// changes materials for finishes.
//
// The first application runs in a layout effect, as a child of
// ProductContent: a child's effects run before its parent's, so the
// precompile and the application and their settle are queued ahead of the
// presentation's ready settle, and the frame ready reports already carries
// the selection. The layout phase also paints no frame between the mount
// and the application, so a remount never flashes the model's default
// finish before the stored one.
//
// The finishes are precompiled once per load, before the first
// application: the held promise makes every application wait on the same
// compile instead of repeating it, and the scene is clean again by the
// time it resolves.
//
// A failed application, a settle included, reaches the product's typed
// failure the way the presentation reports its own: the error is held here
// and thrown on the next render, into the boundary that owns the product's
// failures.
export function ProductFinishes() {
  const loaded = useLoadedProduct()
  const settleScene = useStageSettle()
  const selected = useAppStore((state) => selectSelectedVariant(state, loaded.manifest.slug))
  const precompile = useRef<Promise<ViewerFinish> | null>(null)
  const [failure, setFailure] = useState<Error | null>(null)
  const fail = useCallback((error: Error) => {
    setFailure((first) => first ?? error)
  }, [])

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
    let cancelled = false
    const run = async (): Promise<ViewerFinish> => {
      precompile.current ??= applyFirstFinish({ loaded, variant: selected, settle: settleScene })
      const applied = await precompile.current
      if (applied.applied === selected) {
        return applied
      }
      // The selection moved while the first application was in flight.
      return applyFinish({ loaded, variant: selected, settle: settleScene })
    }
    run().then(
      (finish) => {
        if (!cancelled) {
          publishViewerFinish(finish)
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          fail(asError(cause))
        }
      },
    )
    return () => {
      cancelled = true
      // The record names what the scene carried; once this controller is
      // gone, re-applying it or leaving it behind would both lie.
      publishViewerFinish(null)
    }
  }, [loaded, selected, settleScene, fail])

  if (failure !== null) {
    throw failure
  }
  return null
}
