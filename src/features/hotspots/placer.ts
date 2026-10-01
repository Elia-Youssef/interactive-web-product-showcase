import { Raycaster, Vector3 } from 'three'
import type { Camera, Intersection, Mesh } from 'three'
import { isInsideStageBox, projectToStage, type StageBox } from '@lib/hotspots/projection'
import { isMarkerVisible, isOccluded } from '@lib/hotspots/visibility'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { OverlayPlacement } from '@viewer/overlay/StageOverlay'
import { overlayKey } from './hotspotKeys'

// Per presented frame, per hotspot, the marker's placement: one projection
// of the anchor and one raycast from the camera to it. The placement is
// handed to a write callback, never to the DOM directly, so the class owns
// no channel and the caller decides where placements land.

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

export class HotspotPlacer {
  // The scratch objects of the per-frame loop, owned by the placer so a
  // frame allocates no vectors, matrices or result arrays.
  private readonly raycaster = new Raycaster()
  private readonly anchorWorld = new Vector3()
  private readonly cameraPosition = new Vector3()
  private readonly toAnchor = new Vector3()
  private readonly hits: Intersection[] = []

  // Places every hotspot of the loaded product, in manifest order. The
  // camera's matrices are the ones the presented frame used: the placer runs
  // after the render, which updated the scene's and the camera's world
  // matrices before drawing.
  place(
    loaded: LoadedProduct,
    occluders: Mesh[],
    camera: Camera,
    stage: StageBox,
    write: (key: string, placement: OverlayPlacement) => void,
  ): void {
    camera.getWorldPosition(this.cameraPosition)
    for (const hotspot of loaded.rig.hotspots) {
      hotspot.node.getWorldPosition(this.anchorWorld)
      const projection = projectToStage(
        { x: this.anchorWorld.x, y: this.anchorWorld.y, z: this.anchorWorld.z },
        {
          viewMatrix: camera.matrixWorldInverse.elements,
          projectionMatrix: camera.projectionMatrix.elements,
        },
        stage,
      )
      if (!projection.inFront || !isInsideStageBox(projection, stage)) {
        write(overlayKey(hotspot.id), HIDDEN)
        continue
      }

      this.toAnchor.subVectors(this.anchorWorld, this.cameraPosition)
      const anchorDistance = this.toAnchor.length()
      this.raycaster.set(this.cameraPosition, this.toAnchor)
      // The ray stops at the anchor: any hit it returns is at or in front of
      // the anchor, and the visibility rule decides with no epsilon.
      this.raycaster.far = anchorDistance
      this.hits.length = 0
      this.raycaster.intersectObjects(occluders, false, this.hits)
      const nearest = this.hits[0]
      const occluded = isOccluded(anchorDistance, nearest === undefined ? null : nearest.distance)
      const placement: OverlayPlacement = isMarkerVisible(projection, stage, occluded)
        ? { kind: 'placed', x: projection.x, y: projection.y }
        : HIDDEN
      write(overlayKey(hotspot.id), placement)
    }
  }
}
