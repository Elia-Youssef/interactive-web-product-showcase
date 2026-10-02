import { useLayoutEffect, type RefObject } from 'react'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import type { ExplodeDriver } from './explodeDriver'

// One reaction to the applied progress, built by a factory so its inputs
// are claimed inside the registration's own effect and restored by that
// effect's cleanup. The release touches only the reaction's own inputs,
// never the pose, so it holds whichever of the component's layout cleanups
// React runs first. The factory runs once per registration, never per
// frame.

export type ExplodeReaction = {
  // Applies the reaction at the progress the pose just applied. Runs inside
  // the frame callback, before the render, so the reaction's writes land on
  // the frame that shows the pose; and once at registration, with the
  // progress the pose already holds.
  readonly apply: (progress: number) => void
  // Restores the reaction's inputs, whatever progress was applied last.
  readonly release: () => void
}

export type ExplodeReactionFactory = () => ExplodeReaction

// The one hook through which reactions register on the driver, from this
// feature's own components. Nothing else in the app reads the driver.
export function useExplodeReaction(
  driverRef: RefObject<ExplodeDriver | null>,
  factory: ExplodeReactionFactory,
): void {
  const loaded = useLoadedProduct()
  // The registration lives exactly as long as the load, like the driver it
  // subscribes to and the shadow opacity owner its claim comes from: both
  // are rebuilt for every new load, so a registration keyed on anything
  // narrower would stay subscribed to a disposed driver and hold a claim on
  // an owner that stood down.
  useLayoutEffect(() => {
    const driver = driverRef.current
    // The driver is created by the load's layout effect, which runs before
    // this one in every commit; a missing driver is a broken effect order
    // and fails loudly instead of registering against nothing.
    if (driver === null) {
      throw new Error(`the explode reaction of the product '${loaded.manifest.slug}' has no driver`)
    }
    const reaction = factory()
    const releaseSubscription = driver.subscribe(reaction.apply)
    return () => {
      releaseSubscription()
      reaction.release()
    }
  }, [driverRef, factory, loaded])
}
