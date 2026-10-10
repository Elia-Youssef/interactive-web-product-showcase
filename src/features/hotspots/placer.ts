import { Box3, Vector3 } from 'three/webgpu'
import type { Camera, Mesh } from 'three/webgpu'
import type { MarkerExtent, StageRect } from '@lib/hotspots/markerBox'
import { projectBoxExtent, projectToStage, type StageBox } from '@lib/hotspots/projection'
import { isMarkerPlaceable, isMarkerVisible } from '@lib/hotspots/visibility'
import type { ProductHotspot } from '@viewer/rig/productRig'
import type { OverlayPlacement, OverlayPlaceBox, OverlayRect } from '@viewer/overlay/StageOverlay'
import { AnchorOcclusion } from '@viewer/occlusion/AnchorOcclusion'
import { overlayKey } from '@lib/hotspots/hotspotKeys'

// Per presented frame, per hotspot, the marker's placement: one projection
// of the anchor, and one raycast from the camera to it while the marker's
// keep-out box fits the stage; and the projected extent of the hotspot's
// subject, the part its anchor rides on, published as the overlay's box for
// that hotspot, so whoever places a card beside the marker can keep the
// part the card describes in view. The placement and the box are
// handed to write callbacks, never to the DOM directly, so the class owns
// no channel and the caller decides where they land.

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

export class HotspotPlacer {
  // The scratch objects of the per-frame loop, owned by the placer so a
  // frame allocates no vectors, matrices or result arrays.
  private readonly occlusion = new AnchorOcclusion()
  private readonly anchorWorld = new Vector3()
  private readonly cameraPosition = new Vector3()
  private readonly subjectWorld = new Box3()
  private readonly subjectStage = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }

  // Places the given rig hotspots, in their given order, each by the
  // visibility rule over the marker's extent the stylesheets declare, and
  // publishes each one's subject extent. The camera's
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
    writeBox: OverlayPlaceBox,
    obstacles: readonly StageRect[] = [],
  ): void {
    camera.getWorldPosition(this.cameraPosition)
    const matrices = {
      viewMatrix: camera.matrixWorldInverse.elements,
      projectionMatrix: camera.projectionMatrix.elements,
    }
    for (const hotspot of hotspots) {
      hotspot.node.getWorldPosition(this.anchorWorld)
      const projection = projectToStage(
        { x: this.anchorWorld.x, y: this.anchorWorld.y, z: this.anchorWorld.z },
        matrices,
        stage,
      )
      if (!isMarkerPlaceable(projection, stage, extent, obstacles)) {
        write(overlayKey(hotspot.id), HIDDEN)
        continue
      }

      const occluded = this.occlusion.isBlocked(this.cameraPosition, this.anchorWorld, occluders)
      const placement: OverlayPlacement = isMarkerVisible(
        projection,
        stage,
        extent,
        occluded,
        obstacles,
      )
        ? { kind: 'placed', x: projection.x, y: projection.y }
        : HIDDEN
      write(overlayKey(hotspot.id), placement)
      this.writeSubjectExtent(hotspot, matrices, stage, writeBox)
    }
  }

  // The subject's projected extent, written under the hotspot's own overlay
  // key. A part whose box stands fully behind the camera plane has no
  // projection that means anything, so it publishes nothing and leaves the
  // key's last box standing.
  private writeSubjectExtent(
    hotspot: ProductHotspot,
    matrices: { viewMatrix: ReadonlyArray<number>; projectionMatrix: ReadonlyArray<number> },
    stage: StageBox,
    writeBox: OverlayPlaceBox,
  ): void {
    this.subjectWorld.setFromObject(hotspot.part)
    const min = this.subjectWorld.min
    const max = this.subjectWorld.max
    const onStage = projectBoxExtent(
      { minX: min.x, minY: min.y, minZ: min.z, maxX: max.x, maxY: max.y, maxZ: max.z },
      matrices,
      stage,
      this.subjectStage,
    )
    if (onStage) {
      const extent: OverlayRect = {
        left: this.subjectStage.left,
        top: this.subjectStage.top,
        right: this.subjectStage.right,
        bottom: this.subjectStage.bottom,
      }
      writeBox(overlayKey(hotspot.id), extent)
    }
  }
}
