import { useLayoutEffect, type RefObject } from 'react'
import type { ViewerExplode, ViewerExplodePart } from '@viewer/automation/viewerAutomation'
import { useStageProbes } from '@viewer/automation/stageProbesContext'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import type { ExplodeDriver } from './explodeDriver'

// The exploded view's automation reading, registered as the stage's explode
// probe for the presented view's lifetime: the progress is what the pose
// last applied, moving is whether the driver still owes frames, and the
// parts are the scene graph's own local positions, read at access time.
//
// The registration is a layout effect, beside the driver's own: within one
// commit the driver is created first and released first, so the probe is
// never held without the driver it reads, and the release runs in the same
// synchronous flush that disposes the pose. A read outside that lifetime is
// the released key, which the probes answer with null.
export function useExplodeReading(
  driverRef: RefObject<ExplodeDriver | null>,
  target: number,
): void {
  const loaded = useLoadedProduct()
  const probes = useStageProbes()

  useLayoutEffect(() => {
    const driver = driverRef.current
    // The driver is created by the load's layout effect, which runs before
    // this one in every commit; a missing driver is a broken effect order
    // and fails loudly instead of registering a probe that reads nothing.
    if (driver === null) {
      throw new Error(`the explode reading of the product '${loaded.manifest.slug}' has no driver`)
    }
    return probes.register('explode', () => {
      const parts: Record<string, ViewerExplodePart> = {}
      for (const [name, node] of loaded.rig.parts) {
        parts[name] = { x: node.position.x, y: node.position.y, z: node.position.z }
      }
      return {
        t: driver.appliedProgress(),
        target,
        moving: driver.moving(),
        parts,
      } satisfies ViewerExplode
    })
  }, [probes, loaded, driverRef, target])
}
