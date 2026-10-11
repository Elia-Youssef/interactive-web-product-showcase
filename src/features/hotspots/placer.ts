import { Box3, Vector3 } from 'three/webgpu'
import type { Camera, Mesh, Object3D } from 'three/webgpu'
import type { MarkerExtent, StageRect } from '@lib/hotspots/markerBox'
import { isMarkerPlaceable } from '@lib/hotspots/visibility'
import {
  projectBoxExtent,
  projectToStage,
  type ClipSpaceTarget,
  type StageBox,
  type StageProjectionTarget,
} from '@lib/hotspots/projection'
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
//
// The placer is built for one hotspot list (one product load) and owns
// every record a pass touches: the projection scratch, the camera matrices,
// the subject box, and one output record per anchor. Placeability is
// evaluated once per anchor; the outputs are the change detection as well
// as the memory: a frame whose placement or extent equals the last
// published one publishes nothing, and a change publishes a fresh record,
// so nothing the overlay or a subscriber holds aliases storage a later
// frame overwrites. Hotspots that ride one part share its bounds, measured
// once per pass.

const HIDDEN: OverlayPlacement = { kind: 'hidden' }

// The part bounds shared by every hotspot that rides the part: measured at
// most once per pass, by the first hotspot that needs them.
type PartBounds = {
  readonly object: Object3D
  readonly bounds: Box3
  measured: boolean
}

// One anchor's per-placer state: the hotspot it places, its overlay key,
// the shared bounds of the part the anchor rides, and the placement and
// extent this placer last published under the key.
type AnchorState = {
  readonly hotspot: ProductHotspot
  readonly key: string
  readonly part: PartBounds
  placement: OverlayPlacement | null
  box: OverlayRect | null
}

// The mutable forms of the lib's readonly inputs, owned by the placer and
// refilled per pass.
type CameraMatricesTarget = {
  viewMatrix: ReadonlyArray<number>
  projectionMatrix: ReadonlyArray<number>
}

type WorldBoxTarget = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

type WorldPointTarget = {
  x: number
  y: number
  z: number
}

export class HotspotPlacer {
  // The scratch objects of the per-frame loop, owned by the placer so a
  // frame allocates no vectors, matrices or result records.
  private readonly occlusion = new AnchorOcclusion()
  private readonly anchorWorld = new Vector3()
  private readonly cameraPosition = new Vector3()
  private readonly anchorPoint: WorldPointTarget = { x: 0, y: 0, z: 0 }
  private readonly projection: StageProjectionTarget = { x: 0, y: 0, inFront: false }
  private readonly clip: ClipSpaceTarget = { x: 0, y: 0, w: 0 }
  private readonly matrices: CameraMatricesTarget = { viewMatrix: [], projectionMatrix: [] }
  private readonly subjectBox: WorldBoxTarget = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  }
  private readonly subjectStage = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }
  // One state record per hotspot of the list, in its order, and the
  // distinct parts that list rides, with the bounds shared by every
  // hotspot on the same part.
  private readonly anchors: readonly AnchorState[]
  private readonly parts: readonly PartBounds[]

  constructor(hotspots: readonly ProductHotspot[]) {
    const parts: PartBounds[] = []
    const anchors: AnchorState[] = []
    for (const hotspot of hotspots) {
      const part = partBoundsOf(parts, hotspot.part)
      anchors.push({ hotspot, key: overlayKey(hotspot.id), part, placement: null, box: null })
    }
    this.anchors = anchors
    this.parts = parts
  }

  // Places the placer's hotspots, in their order, each by the visibility
  // rule over the marker's extent the stylesheets declare, and publishes
  // each one's subject extent. The camera's matrices are the ones the
  // presented frame used: the placer runs after the render, which updated
  // the scene's and the camera's world matrices before drawing.
  place(
    occluders: Mesh[],
    camera: Camera,
    stage: StageBox,
    extent: MarkerExtent,
    write: (key: string, placement: OverlayPlacement) => void,
    writeBox: OverlayPlaceBox,
    obstacles: readonly StageRect[],
  ): void {
    // A pass starts with every part unmeasured: the pose may have moved
    // since the last one, and each part is measured at most once in it.
    for (const part of this.parts) {
      part.measured = false
    }
    camera.getWorldPosition(this.cameraPosition)
    this.matrices.viewMatrix = camera.matrixWorldInverse.elements
    this.matrices.projectionMatrix = camera.projectionMatrix.elements
    for (const anchor of this.anchors) {
      const hotspot = anchor.hotspot
      hotspot.node.getWorldPosition(this.anchorWorld)
      this.anchorPoint.x = this.anchorWorld.x
      this.anchorPoint.y = this.anchorWorld.y
      this.anchorPoint.z = this.anchorWorld.z
      projectToStage(this.anchorPoint, this.matrices, stage, this.projection, this.clip)
      // Placeability is decided once: an unplaceable marker is hidden, a
      // placeable one is hidden only by an occluder.
      if (!isMarkerPlaceable(this.projection, stage, extent, obstacles)) {
        this.publishHidden(anchor, write)
        continue
      }

      const occluded = this.occlusion.isBlocked(this.cameraPosition, this.anchorWorld, occluders)
      if (occluded) {
        this.publishHidden(anchor, write)
      } else {
        this.publishPlaced(anchor, this.projection, write)
      }
      this.writeSubjectExtent(anchor, this.matrices, stage, writeBox)
    }
  }

  // Publishes the placement only when it differs from the anchor's last
  // one, as a fresh record the overlay holds until a later change replaces
  // it.
  private publishPlaced(
    anchor: AnchorState,
    projection: StageProjectionTarget,
    write: (key: string, placement: OverlayPlacement) => void,
  ): void {
    const last = anchor.placement
    if (
      last !== null &&
      last.kind === 'placed' &&
      last.x === projection.x &&
      last.y === projection.y
    ) {
      return
    }
    const placement: OverlayPlacement = { kind: 'placed', x: projection.x, y: projection.y }
    anchor.placement = placement
    write(anchor.key, placement)
  }

  private publishHidden(
    anchor: AnchorState,
    write: (key: string, placement: OverlayPlacement) => void,
  ): void {
    if (anchor.placement === HIDDEN) {
      return
    }
    anchor.placement = HIDDEN
    write(anchor.key, HIDDEN)
  }

  // The subject's projected extent, written under the hotspot's own overlay
  // key when it differs from the anchor's last one. A part whose box stands
  // fully behind the camera plane has no projection that means anything, so
  // it publishes nothing and leaves the key's last box standing.
  private writeSubjectExtent(
    anchor: AnchorState,
    matrices: CameraMatricesTarget,
    stage: StageBox,
    writeBox: OverlayPlaceBox,
  ): void {
    const part = anchor.part
    if (!part.measured) {
      part.bounds.setFromObject(part.object)
      part.measured = true
    }
    const min = part.bounds.min
    const max = part.bounds.max
    const box = this.subjectBox
    box.minX = min.x
    box.minY = min.y
    box.minZ = min.z
    box.maxX = max.x
    box.maxY = max.y
    box.maxZ = max.z
    if (!projectBoxExtent(box, matrices, stage, this.subjectStage, this.clip)) {
      return
    }
    const last = anchor.box
    const target = this.subjectStage
    if (
      last !== null &&
      last.left === target.left &&
      last.top === target.top &&
      last.right === target.right &&
      last.bottom === target.bottom
    ) {
      return
    }
    const extent: OverlayRect = {
      left: target.left,
      top: target.top,
      right: target.right,
      bottom: target.bottom,
    }
    anchor.box = extent
    writeBox(anchor.key, extent)
  }
}

// The part bounds for a part already seen in this list, or a fresh one for
// a part no earlier hotspot rides.
function partBoundsOf(parts: PartBounds[], object: Object3D): PartBounds {
  for (const part of parts) {
    if (part.object === object) {
      return part
    }
  }
  const part: PartBounds = { object, bounds: new Box3(), measured: false }
  parts.push(part)
  return part
}
