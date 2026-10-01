import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useAppStore } from '@store/index'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { createExplodeDriver, type ExplodeDriver } from './explodeDriver'
import { createExplodePose } from './explodePose'

// The presented view's lifetime, as one paired effect. The layout effect
// creates the pose and its driver (never during render: an effect-created
// resource is released by its own effect's cleanup), attaches the product's
// view to the store, and the cleanup undoes all three in the same order.
// StrictMode's simulated unmount ends attached and assembled, exactly like
// a production unmount, because attach and detach are two halves of the
// same lifetime and nothing arms outside it.
//
// The assembled pose is applied by the driver right here, in a layout
// effect: a child's layout effects run before the parent's passive
// effects, so the pose is on the scene before the product's presentation
// settle compiles and records the frame that reports ready.
export function useExplodeDriver(): RefObject<ExplodeDriver | null> {
  const loaded = useLoadedProduct()
  const slug = loaded.manifest.slug
  const explodeAttach = useAppStore((state) => state.explodeAttach)
  const explodeDetach = useAppStore((state) => state.explodeDetach)
  const driverRef = useRef<ExplodeDriver | null>(null)

  useLayoutEffect(() => {
    const driver = createExplodeDriver(
      createExplodePose(loaded.scene, loaded.rig.clip),
      performance.now(),
    )
    driverRef.current = driver
    explodeAttach(slug)
    return () => {
      driverRef.current = null
      driver.dispose()
      explodeDetach(slug)
    }
  }, [loaded, slug, explodeAttach, explodeDetach])

  return driverRef
}
