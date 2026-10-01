import { useEffect, type RefObject } from 'react'
import { useAppStoreApi } from '@store/index'
import { clearExplodeReading, setExplodeReading } from '@viewer/automation/explodeSource'
import type { ViewerExplode, ViewerExplodePart } from '@viewer/automation/viewerAutomation'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import type { ExplodeDriver } from './explodeDriver'

// The exploded view's automation reading, registered for the store the
// bridge outside the canvas serves. Every field reads the real thing: the
// progress is what the pose last applied, moving is whether the driver
// still owes frames, and the parts are the scene graph's own local
// positions. The driver is null only between the layout cleanup and this
// cleanup on unmount, and the reading reports null then, like the
// unregistered state it is.
export function useExplodeReading(
  driverRef: RefObject<ExplodeDriver | null>,
  target: number,
): void {
  const loaded = useLoadedProduct()
  const store = useAppStoreApi()

  useEffect(() => {
    const reading = (): ViewerExplode | null => {
      const driver = driverRef.current
      if (driver === null) {
        return null
      }
      const parts: Record<string, ViewerExplodePart> = {}
      for (const [name, node] of loaded.rig.parts) {
        parts[name] = { x: node.position.x, y: node.position.y, z: node.position.z }
      }
      return {
        t: driver.appliedProgress(),
        target,
        moving: driver.moving(),
        parts,
      }
    }
    setExplodeReading(store, reading)
    return () => {
      clearExplodeReading(store, reading)
    }
  }, [store, loaded, driverRef, target])
}
