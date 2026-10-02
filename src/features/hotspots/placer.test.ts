import { BoxGeometry, Group, Mesh, Object3D, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { HotspotPlacer } from './placer'
import type { OverlayPlacement } from '@viewer/overlay/StageOverlay'
import type { ProductHotspot } from '@viewer/rig/productRig'

// The placer against real three meshes, in Node: the camera on +Z looking
// down its -Z axis, the anchor on that axis at the case's distance, and one
// occluding plate on the axis between the camera and the anchor, behind it,
// or absent. The plate is 0.1 m square and 0.01 thick, so its bounding
// sphere is small against every ray length here: when the direction is not
// unit, the pretest's perpendicular-distance arithmetic is the step that
// rejects the plate, before the triangles are read.

const STAGE = { width: 800, height: 600 }
const CAMERA_Z_M = 5

// The camera-to-anchor distances the cases walk: below 1 m, where a ray
// cast on a non-unit direction kept markers visible behind real occluders,
// at 1 m, and above.
const DISTANCES_M = [0.3, 0.5, 1, 2, 5] as const

const PLATE = new BoxGeometry(0.1, 0.1, 0.01)

// The placement the placer writes for its one hotspot in a scene built for
// the given anchor distance and occluder position, null for no occluder.
function placedAt(distanceM: number, occluderZM: number | null): OverlayPlacement {
  const camera = new PerspectiveCamera()
  camera.position.set(0, 0, CAMERA_Z_M)
  camera.updateMatrixWorld(true)

  const anchor = new Object3D()
  anchor.position.set(0, 0, CAMERA_Z_M - distanceM)

  const occluders: Mesh[] = []
  if (occluderZM !== null) {
    const plate = new Mesh(PLATE)
    plate.position.set(0, 0, occluderZM)
    const scene = new Group()
    scene.add(plate)
    scene.updateMatrixWorld(true)
    occluders.push(plate)
  }

  const hotspots: ProductHotspot[] = [{ id: 'probe', node: anchor, part: anchor }]
  let placement: OverlayPlacement | undefined
  new HotspotPlacer().place(hotspots, occluders, camera, STAGE, (_key, value) => {
    placement = value
  })
  if (placement === undefined) {
    throw new Error('the placer must write one placement per hotspot')
  }
  return placement
}

describe('HotspotPlacer', () => {
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
})
