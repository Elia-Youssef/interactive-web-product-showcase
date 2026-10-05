import { Vector3 } from 'three'
import type { Camera, Mesh } from 'three'
import type { MarkerExtent } from '@lib/hotspots/markerBox'
import { projectToStage, type StageBox } from '@lib/hotspots/projection'
import { isMarkerPlaceable, isMarkerVisible } from '@lib/hotspots/visibility'
import type { ProductHotspot } from '@viewer/rig/productRig'
import type { OverlayPlacement } from '@viewer/overlay/StageOverlay'
import { AnchorOcclusion } from '@viewer/occlusion/AnchorOcclusion'
import { overlayKey } from '@lib/hotspots/hotspotKeys'

// Per presented frame, per hotspot, the marker's placement: one projection
// of the anchor, and one raycast from the camera to it while the marker's
// keep-out box fits the stage. The placement is
// handed to a write callback, never to the DOM directly, so the class owns
// no channel and the caller decides where placements land.

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

export class HotspotPlacer {
  // The scratch objects of the per-frame loop, owned by the placer so a
  // frame allocates no vectors, matrices or result arrays.
  private readonly occlusion = new AnchorOcclusion()
  private readonly anchorWorld = new Vector3()
  private readonly cameraPosition = new Vector3()

  // Places the given rig hotspots, in their given order, each by the
  // visibility rule over the marker's extent the stylesheets declare. The camera's
  // matrices are the ones the presented frame used: the placer runs after
  // the render, which updated the scene's and the camera's world matrices
  // before drawing.
  place(
    hotspots: readonly ProductHotspot[],
    occluders: Mesh[],
    camera: Camera,
    stage: StageBox,
    extent: MarkerExtent,
    write: (key: string, placement: OverlayPlacement) => void,
  ): void {
    camera.getWorldPosition(this.cameraPosition)
    for (const hotspot of hotspots) {
      hotspot.node.getWorldPosition(this.anchorWorld)
      const projection = projectToStage(
        { x: this.anchorWorld.x, y: this.anchorWorld.y, z: this.anchorWorld.z },
        {
          viewMatrix: camera.matrixWorldInverse.elements,
          projectionMatrix: camera.projectionMatrix.elements,
        },
        stage,
      )
      if (!isMarkerPlaceable(projection, stage, extent)) {
        write(overlayKey(hotspot.id), HIDDEN)
        continue
      }

      const occluded = this.occlusion.isBlocked(this.cameraPosition, this.anchorWorld, occluders)
      const placement: OverlayPlacement = isMarkerVisible(projection, stage, extent, occluded)
        ? { kind: 'placed', x: projection.x, y: projection.y }
        : HIDDEN
      write(overlayKey(hotspot.id), placement)
    }
  }
}
