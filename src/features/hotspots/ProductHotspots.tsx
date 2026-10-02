import { useCallback, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { ViewerHotspotsAutomation } from '@viewer/automation/viewerAutomation'
import { useStageProbes } from '@viewer/automation/stageProbesContext'
import { useLoadedProduct, type LoadedProduct } from '@viewer/product/loadedProduct'
import { usePresentedFrame } from '@viewer/stageFramesContext'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { collectOccluders } from './occluders'
import { HotspotPlacer } from './placer'

// The canvas side of the hotspots: one child of the loaded product that
// places its markers, once per presented frame, into the stage's overlay
// channel. Per frame and per rig hotspot it reads the anchor's world
// position from its HS_ node, projects it into stage pixels, casts one ray
// from the camera to the anchor through the product's occluders, and writes
// one placement. The work runs after the render, so it reads the world and
// camera matrices that frame used, whichever frame callback wrote them.
//
// The occluders are every mesh of the product except the rig's shadow
// subtree, collected once per load: finishes swap materials, never geometry.
// The same effect registers the stage's hotspots probe, so the automation
// reads each anchor's live world position while this side holds the product.
export function ProductHotspots() {
  const loaded = useLoadedProduct()
  const overlay = useStageOverlay()
  const probes = useStageProbes()
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  const occluders = useMemo(() => collectOccluders(loaded), [loaded])
  const placer = useMemo(() => new HotspotPlacer(), [])
  const place = useCallback(
    () =>
      placer.place(loaded.rig.hotspots, occluders, camera, size, (key, placement) =>
        overlay.place(key, placement),
      ),
    [placer, loaded, occluders, camera, size, overlay],
  )
  usePresentedFrame(place)

  useEffect(
    () => probes.register('hotspots', () => readHotspotsAutomation(loaded)),
    [loaded, probes],
  )

  return null
}

// The probe value, read at access time from the HS_ nodes themselves, so it
// is wherever each anchor stands now, motion included. An access-time read
// is off the frame path, so its scratch vector costs nothing at rest.
function readHotspotsAutomation(loaded: LoadedProduct): ViewerHotspotsAutomation {
  const position = new Vector3()
  return {
    product: loaded.manifest.slug,
    hotspots: loaded.rig.hotspots.map((hotspot) => {
      hotspot.node.getWorldPosition(position)
      return { id: hotspot.id, position: { x: position.x, y: position.y, z: position.z } }
    }),
  }
}
