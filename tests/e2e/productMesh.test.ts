import {
  BackSide,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { expect, it } from 'vitest'
import { Raycaster, Vector3 } from 'three'
import { isBlocked } from './productMesh'
import { markersShownIn } from './productMarkerViews'
import type { AuthoredView } from './productCamera'

const ORIGIN: [number, number, number] = [0, 0, 2]
const ANCHOR: [number, number, number] = [0, 0, 0]
const STAGE = { box: { width: 480, height: 300 }, extent: { markerHitPx: 44, focusOutsetPx: 5 } }
const VIEW: AuthoredView = {
  position: ORIGIN,
  target: ANCHOR,
  fovY: Math.PI / 6,
  aspect: 1.6,
  near: 0.1,
  far: 10,
  distance: 2,
  azimuthDegrees: 0,
  polarDegrees: 90,
}

const sides = [
  { name: 'FrontSide', side: FrontSide, front: true, back: false },
  { name: 'BackSide', side: BackSide, front: false, back: true },
  { name: 'DoubleSide', side: DoubleSide, front: true, back: true },
]

// The clockwise triangle is the minimal back-face disagreement: a camera
// at +Z, an anchor at zero, and a single-sided triangle at Z=1 facing -Z.
for (const { name, side, front, back } of sides) {
  for (const winding of ['front', 'back'] as const) {
    it(`${name} ${winding} winding agrees between facts and three raycasts`, () => {
      const geometry = new BufferGeometry()
      const vertices =
        winding === 'back' ? [-1, -1, 1, 0, 1, 1, 1, -1, 1] : [-1, -1, 1, 1, -1, 1, 0, 1, 1]
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      const material = new MeshBasicMaterial({ side })
      const mesh = new Mesh(geometry, material)
      mesh.updateMatrixWorld(true)
      const blocked = winding === 'front' ? front : back
      const raycaster = new Raycaster(new Vector3(...ORIGIN), new Vector3(0, 0, -1), 0, 2)
      try {
        expect(raycaster.intersectObject(mesh, false).length > 0).toBe(blocked)
        expect.soft(isBlocked(ORIGIN, ANCHOR, [mesh])).toBe(blocked)
        const shown = markersShownIn(
          { hotspots: [{ id: 'example', stagePosition: ANCHOR }], occluders: [mesh] },
          VIEW,
          STAGE,
        )
        expect.soft(shown.has('example')).toBe(!blocked)
        expect(material.side).toBe(side)
      } finally {
        geometry.dispose()
        material.dispose()
      }
    })
  }
}
