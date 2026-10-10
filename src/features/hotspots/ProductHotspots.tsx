import { useCallback, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Vector3 } from 'three/webgpu'
import type { ViewerHotspotsAutomation } from '@viewer/automation/viewerAutomation'
import { useStageProbes } from '@viewer/automation/stageProbesContext'
import { useLoadedProduct, type LoadedProduct } from '@viewer/product/loadedProduct'
import { usePresentedFrame } from '@viewer/stageFrameContext'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { collectOccluders } from './occluders'
import { readMarkerExtent } from '@lib/hotspots/cardLayout'
import { MarkerExtentSource } from './markerExtentSource'
import { HotspotPlacer } from './placer'

// The canvas side of the hotspots: one child of the loaded product that
// places its markers, once per presented frame, into the overlay channel
// of the canvas it renders in. Per frame and per rig hotspot it reads the
// anchor's world position from its HS_ node, projects it into stage pixels,
// casts one ray from the camera to the anchor through the product's
// occluders, and writes one placement, all inside one overlay pass in the
// frame's stage box. The pass runs in the stage's post-present phase, as
// the product's content code: only after a frame that presented, so it
// reads the world and camera matrices that frame used, whichever frame
// callback wrote them, and a frame that failed or was skipped writes no
// placement. A pass that throws fails the product like any of its frame
// work.
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
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => overlay.geometry.subscribe(invalidate), [overlay, invalidate])

  const occluders = useMemo(() => collectOccluders(loaded), [loaded])
  const placer = useMemo(() => new HotspotPlacer(), [])
  // The marker extent comes from the tokens on the document root, per
  // stage size.
  const extentSource = useMemo(
    () =>
      new MarkerExtentSource(() => readMarkerExtent(getComputedStyle(document.documentElement))),
    [],
  )
  // One overlay pass per presented frame: every marker of the frame is
  // written before the overlay's pass listeners, the open card among them,
  // decide against the complete set, and every hotspot's subject extent is
  // published with it, so the open card's decision always reads the extent
  // of the frame that placed its marker.
  const place = useCallback(
    () =>
      overlay.pass(size, (write, writeBox) =>
        placer.place(
          loaded.rig.hotspots,
          occluders,
          camera,
          size,
          extentSource.for(size),
          write,
          writeBox,
          overlay.geometry.read(size),
        ),
      ),
    [placer, loaded, occluders, camera, size, extentSource, overlay],
  )
  usePresentedFrame('content', place)

  useEffect(
    () => probes.register('hotspots', () => readHotspotsAutomation(loaded)),
    [loaded, probes],
  )

  return null
}

// The probe value, read at access time from the HS_ nodes and their parts
// themselves, so it is wherever each anchor and its subject stand now,
// motion included. An access-time read is off the frame path, so its scratch
// objects cost nothing at rest.
function readHotspotsAutomation(loaded: LoadedProduct): ViewerHotspotsAutomation {
  const position = new Vector3()
  const subject = new Box3()
  return {
    product: loaded.manifest.slug,
    hotspots: loaded.rig.hotspots.map((hotspot) => {
      hotspot.node.getWorldPosition(position)
      subject.setFromObject(hotspot.part)
      return {
        id: hotspot.id,
        position: { x: position.x, y: position.y, z: position.z },
        subject: {
          min: { x: subject.min.x, y: subject.min.y, z: subject.min.z },
          max: { x: subject.max.x, y: subject.max.y, z: subject.max.z },
        },
      }
    }),
  }
}
