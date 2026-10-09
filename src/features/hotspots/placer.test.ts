import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
} from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { HotspotPlacer } from './placer'
import type { OverlayPlacement, OverlayRect } from '@viewer/overlay/StageOverlay'
import type { ProductHotspot } from '@viewer/rig/productRig'

// The placer against real three meshes, in Node: the camera on +Z looking
// down its -Z axis, the anchor on that axis at the case's distance, and one
// occluding plate on the axis between the camera and the anchor, behind it,
// or absent. The plate is 0.1 m square and 0.01 thick, so its bounding
// sphere is small against every ray length here: when the direction is not
// unit, the pretest's perpendicular-distance arithmetic is the step that
// rejects the plate, before the triangles are read.

const STAGE = { width: 800, height: 600 }
// The marker extent of the tokens: a 44 px hit box and a 5 px ring reach.
const EXTENT = { markerHitPx: 44, focusOutsetPx: 5 }
const CAMERA_Z_M = 5

// The camera-to-anchor distances the cases walk: below 1 m, where a ray
// cast on a non-unit direction kept markers visible behind real occluders,
// at 1 m, and above.
const DISTANCES_M = [0.3, 0.5, 1, 2, 5] as const

const PLATE = new BoxGeometry(0.1, 0.1, 0.01)
// The subject part of every case: a 0.2 m cube centered on the anchor, so
// its projected extent is the projection of a known box.
const PART = new BoxGeometry(0.2, 0.2, 0.2)

// One hotspot whose anchor sits at the origin of a part that carries the
// part geometry, both at the given world position.
function hotspotAt(id: string, positionZ: number): ProductHotspot {
  const anchor = new Object3D()
  const part = new Group()
  part.add(new Mesh(PART))
  part.add(anchor)
  part.position.set(0, 0, positionZ)
  part.updateMatrixWorld(true)
  return { id, node: anchor, part }
}

type PlacerWrites = {
  placements: Map<string, OverlayPlacement>
  boxes: Map<string, OverlayRect>
}

// The writes of one placer run over the given hotspots.
function writesOf(
  hotspots: readonly ProductHotspot[],
  occluders: Mesh[],
  camera: PerspectiveCamera,
): PlacerWrites {
  const writes: PlacerWrites = { placements: new Map(), boxes: new Map() }
  new HotspotPlacer().place(
    hotspots,
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
  )
  return writes
}

// The placement the placer writes for its one hotspot in a scene built for
// the given anchor distance and occluder position, null for no occluder.
function placedAt(distanceM: number, occluderZM: number | null): OverlayPlacement {
  const camera = new PerspectiveCamera()
  camera.position.set(0, 0, CAMERA_Z_M)
  camera.updateMatrixWorld(true)

  const occluders: Mesh[] = []
  if (occluderZM !== null) {
    const plate = new Mesh(PLATE)
    plate.position.set(0, 0, occluderZM)
    const scene = new Group()
    scene.add(plate)
    scene.updateMatrixWorld(true)
    occluders.push(plate)
  }

  const writes = writesOf([hotspotAt('probe', CAMERA_Z_M - distanceM)], occluders, camera)
  const placement = writes.placements.get('hotspot:probe')
  if (placement === undefined) {
    throw new Error('the placer must write one placement per hotspot')
  }
  return placement
}

describe('HotspotPlacer', () => {
  it('places an anchor behind a FrontSide triangle viewed from its back face', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 1, 0, 1, 1, 1, -1, 1], 3))
    const material = new MeshBasicMaterial()
    const mesh = new Mesh(geometry, material)
    mesh.updateMatrixWorld(true)
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 2)
    camera.updateMatrixWorld(true)
    const node = new Object3D()
    node.updateMatrixWorld(true)
    const placements: OverlayPlacement[] = []
    try {
      new HotspotPlacer().place(
        [{ id: 'example', node, part: node }],
        [mesh],
        camera,
        STAGE,
        EXTENT,
        (_key, placement) => placements.push(placement),
        () => {},
      )
      expect(placements).toEqual([{ kind: 'placed', x: 400, y: 300 }])
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  describe('against an occluder between the camera and the anchor', () => {
    for (const distanceM of DISTANCES_M) {
      it(`hides the marker at ${distanceM} m camera-to-anchor distance`, () => {
        expect(placedAt(distanceM, CAMERA_Z_M - distanceM / 2)).toEqual({ kind: 'hidden' })
      })
    }
  })

  describe('the same scenes without the occluder', () => {
    for (const distanceM of DISTANCES_M) {
      it(`places the marker at ${distanceM} m camera-to-anchor distance on the stage center`, () => {
        expect(placedAt(distanceM, null)).toEqual({ kind: 'placed', x: 400, y: 300 })
      })
    }
  })

  describe('against an occluder behind the anchor', () => {
    for (const distanceM of DISTANCES_M) {
      it(`places the marker at ${distanceM} m camera-to-anchor distance on the stage center`, () => {
        expect(placedAt(distanceM, CAMERA_Z_M - distanceM - 0.2)).toEqual({
          kind: 'placed',
          x: 400,
          y: 300,
        })
      })
    }
  })

  describe('the subject extent', () => {
    // The projected half extents of the 0.2 m part cube at the given camera
    // distance, in stage pixels per axis. The widest projections come from
    // the cube's near face, a tenth of a meter closer to the camera.
    function halfExtentPx(
      distanceM: number,
      camera: PerspectiveCamera,
    ): {
      x: number
      y: number
    } {
      const halfM = 0.1
      const nearM = distanceM - halfM
      const yHalfAngle = (camera.fov * Math.PI) / 360
      const xHalfAngle = Math.atan(Math.tan(yHalfAngle) * camera.aspect)
      return {
        x: (halfM / (nearM * Math.tan(xHalfAngle))) * (STAGE.width / 2),
        y: (halfM / (nearM * Math.tan(yHalfAngle))) * (STAGE.height / 2),
      }
    }

    it('publishes the projected extent of the part the anchor rides on', () => {
      const camera = new PerspectiveCamera()
      camera.position.set(0, 0, CAMERA_Z_M)
      camera.updateMatrixWorld(true)
      const distanceM = 2
      const writes = writesOf([hotspotAt('probe', CAMERA_Z_M - distanceM)], [], camera)
      expectBoxAtExtent(writes, distanceM, camera)
    })

    it('publishes the extent of a marker hidden by an occluder, which stays placeable', () => {
      const camera = new PerspectiveCamera()
      camera.position.set(0, 0, CAMERA_Z_M)
      camera.updateMatrixWorld(true)
      const distanceM = 2
      const plate = new Mesh(PLATE)
      plate.position.set(0, 0, CAMERA_Z_M - distanceM / 2)
      const scene = new Group()
      scene.add(plate)
      scene.updateMatrixWorld(true)
      const writes = writesOf([hotspotAt('probe', CAMERA_Z_M - distanceM)], [plate], camera)
      expect(writes.placements.get('hotspot:probe')).toEqual({ kind: 'hidden' })
      expectBoxAtExtent(writes, distanceM, camera)
    })

    // The extent of the 0.2 m part cube centered on the stage center,
    // against this module's own half-extent arithmetic: the exact matrices
    // differ from the closed form by ulps, so the fields compare closely.
    function expectBoxAtExtent(
      writes: PlacerWrites,
      distanceM: number,
      camera: PerspectiveCamera,
    ): void {
      const half = halfExtentPx(distanceM, camera)
      const box = writes.boxes.get('hotspot:probe')
      expect(box).toBeDefined()
      expect(box?.left).toBeCloseTo(400 - half.x, 4)
      expect(box?.top).toBeCloseTo(300 - half.y, 4)
      expect(box?.right).toBeCloseTo(400 + half.x, 4)
      expect(box?.bottom).toBeCloseTo(300 + half.y, 4)
    }
  })

  // An unoccluded anchor at 2 m, moved sideways so it projects the given
  // number of stage pixels from the left edge: the camera's horizontal
  // half extent at that depth maps to half the stage width.
  function placedFromLeftEdge(pixels: number): OverlayPlacement {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, CAMERA_Z_M)
    camera.updateMatrixWorld(true)
    const depthM = 2
    const halfWidthM = depthM * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
    const hotspot = hotspotAt('edge', CAMERA_Z_M - depthM)
    hotspot.part.position.set((pixels / (STAGE.width / 2) - 1) * halfWidthM, 0, CAMERA_Z_M - depthM)
    hotspot.part.updateMatrixWorld(true)
    const writes = writesOf([hotspot], [], camera)
    const placement = writes.placements.get('hotspot:edge')
    if (placement === undefined) {
      throw new Error('the placer must write one placement per hotspot')
    }
    return placement
  }

  describe('near a stage edge', () => {
    it('hides a marker whose center is inside but whose keep-out box crosses the edge', () => {
      expect(placedFromLeftEdge(10)).toEqual({ kind: 'hidden' })
    })

    it('places a marker whose keep-out box fits inside the stage', () => {
      const placement = placedFromLeftEdge(40)
      expect(placement.kind).toBe('placed')
    })
  })
})
