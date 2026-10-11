import { BoxGeometry, Group, Mesh, Object3D, PerspectiveCamera } from 'three/webgpu'
import type { ProductHotspot } from '@viewer/rig/productRig'
import { HotspotPlacer } from './placer'
import type { OverlayPlacement, OverlayRect } from '@viewer/overlay/StageOverlay'

// The scenes and recorders of the placer's unit tables: the cameras and
// marker extents both test files share, the single-anchor and crowd
// fixtures, and the pass recorder that watches what one placer publishes
// across several passes.

// No chrome obstacles: the empty array the tests pass explicitly.
export const NO_OBSTACLES: readonly never[] = []

export const STAGE = { width: 800, height: 600 }
// The marker extent of the tokens: a 44 px hit box and a 5 px ring reach.
export const EXTENT = { markerHitPx: 44, focusOutsetPx: 5 }
export const CAMERA_Z_M = 5

// The subject part of every case: a 0.2 m cube centered on the anchor, so
// its projected extent is the projection of a known box.
export const PART = new BoxGeometry(0.2, 0.2, 0.2)

// One hotspot whose anchor sits at the origin of a part that carries the
// part geometry, both at the given world position.
export function hotspotAt(id: string, positionZ: number): ProductHotspot {
  const anchor = new Object3D()
  const part = new Group()
  part.add(new Mesh(PART))
  part.add(anchor)
  part.position.set(0, 0, positionZ)
  part.updateMatrixWorld(true)
  return { id, node: anchor, part }
}

export type PlacerWrites = {
  placements: Map<string, OverlayPlacement>
  boxes: Map<string, OverlayRect>
}

export function recordWrites(): PlacerWrites {
  return { placements: new Map(), boxes: new Map() }
}

// The writes of one placer run over the given hotspots.
export function writesOf(
  hotspots: readonly ProductHotspot[],
  occluders: Mesh[],
  camera: PerspectiveCamera,
): PlacerWrites {
  const writes = recordWrites()
  new HotspotPlacer(hotspots).place(
    occluders,
    camera,
    STAGE,
    EXTENT,
    (key, placement) => {
      writes.placements.set(key, placement)
    },
    (key, box) => {
      writes.boxes.set(key, box)
    },
    NO_OBSTACLES,
  )
  return writes
}

// A camera on +Z looking down its -Z axis, the standard eye of the tables.
export function cameraLookingDownZ(zM: number): PerspectiveCamera {
  const camera = new PerspectiveCamera()
  camera.position.set(0, 0, zM)
  camera.updateMatrixWorld(true)
  return camera
}

// The crowd fixture: four parts with three anchors each, twelve hotspots
// in all, none of them a shipped product's. Every part's mesh is an
// occluder, as the product path collects them.
export const CROWD_PARTS = 4
export const CROWD_ANCHORS_PER_PART = 3

export type CrowdFixture = {
  hotspots: ProductHotspot[]
  occluders: Mesh[]
  camera: PerspectiveCamera
  parts: Group[]
}

export function crowdFixture(): CrowdFixture {
  const camera = cameraLookingDownZ(6)
  const hotspots: ProductHotspot[] = []
  const occluders: Mesh[] = []
  const parts: Group[] = []
  const partX = [-1.2, -0.4, 0.4, 1.2]
  for (let part = 0; part < CROWD_PARTS; part += 1) {
    const group = new Group()
    const mesh = new Mesh(PART)
    group.add(mesh)
    occluders.push(mesh)
    group.position.set(partX[part] ?? 0, 0, 0)
    for (let anchor = 0; anchor < CROWD_ANCHORS_PER_PART; anchor += 1) {
      const node = new Object3D()
      node.position.set(0, (anchor - 1) * 0.22, 0.15)
      group.add(node)
      hotspots.push({ id: `p${part}a${anchor}`, node, part: group })
    }
    group.updateMatrixWorld(true)
    parts.push(group)
  }
  return { hotspots, occluders, camera, parts }
}

// Several passes of one placer over the given scene, recording what each
// pass published, with an optional step between passes that may move the
// scene.
export function passesOf(
  hotspots: readonly ProductHotspot[],
  occluders: Mesh[],
  camera: PerspectiveCamera,
  passCount: number,
  betweenPasses?: () => void,
): PlacerWrites[] {
  const placer = new HotspotPlacer(hotspots)
  const passes: PlacerWrites[] = []
  for (let pass = 0; pass < passCount; pass += 1) {
    if (pass > 0) {
      betweenPasses?.()
    }
    const writes = recordWrites()
    placer.place(
      occluders,
      camera,
      STAGE,
      EXTENT,
      (key, placement) => {
        writes.placements.set(key, placement)
      },
      (key, box) => {
        writes.boxes.set(key, box)
      },
      NO_OBSTACLES,
    )
    passes.push(writes)
  }
  return passes
}
