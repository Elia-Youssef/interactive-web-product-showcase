import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three/webgpu'
import { lensOfZoom, zoomOfLens } from '@lib/camera/lens'
import { degrees, LENS_TABLE } from '@lib/camera/fixtures'

// The lib lens math against the projection that runs it: the zoom a view
// lens maps to is the one whose camera presents the view lens, both ways,
// through three's own PerspectiveCamera. This is the layer three reaches,
// so the cross-check lives here.

describe('the lens math against the three projection', () => {
  it('presents the view lens through the zoom the lens maps to', () => {
    // A camera carrying the base fov at that zoom presents exactly the
    // view lens through getEffectiveFOV. The only inexactness is the
    // degree round trip the camera's fov API makes, hence the precision.
    for (const { base, view } of LENS_TABLE) {
      const camera = new PerspectiveCamera(base, 1.6, 0.1, 10)
      camera.zoom = zoomOfLens(degrees(base), degrees(view))
      expect(degrees(camera.getEffectiveFOV())).toBeCloseTo(degrees(view), 12)
    }
  })

  it('reads the effective fov of a zoomed camera back as the view lens', () => {
    for (const { base, view } of LENS_TABLE) {
      const camera = new PerspectiveCamera(base, 1.6, 0.1, 10)
      camera.zoom = zoomOfLens(degrees(base), degrees(view))
      expect(lensOfZoom(degrees(base), camera.zoom)).toBeCloseTo(degrees(view), 12)
    }
  })
})
