import { expect, test } from './fixtures'
import { harnessPath, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import {
  harnessCanvasDrivePoint,
  harnessStageAspect,
  markerOf,
  requireCamera,
} from './hotspotViews'
import { flowFacts } from './hotspotFlowFacts'
import { dragOnCanvas } from './stageCamera'

// The orbit pivot of a close-up: every close-up's orbit target is the point
// on its authored view ray nearest its own hotspot anchor at rest, the one
// the camera facts derive from the shipped model through the same pivot
// rule the plan and validate run. The target is the controls' end state,
// which setLookAt copies from the view exactly (camera-controls
// dist/camera-controls.module.js, setLookAt: _targetEnd.copy), so the check
// is equality, at rest and after an orbit drag, which turns the camera
// around the target and never moves it.

const { flows } = await flowFacts()

for (const flow of flows) {
  const slug = flow.subject.product.slug

  for (const closeUp of flow.subject.closeUps) {
    test(`hotspots ${slug}: the ${closeUp.title} close-up orbits its anchor's point on its view ray, and a drag keeps it`, async ({
      page,
      backendPath,
    }) => {
      await page.goto(harnessPath(backendPath, slug))
      await waitForProductReady(page)
      await settledFrames(page)

      await markerOf(page, closeUp.title).click()
      await settledFrames(page)

      const expected = flow.viewAt(closeUp.view, await harnessStageAspect(page))
      const camera = await requireCamera(page)
      expect(camera.target).toEqual(expected.target)

      const drivePoint = await harnessCanvasDrivePoint(page)
      await dragOnCanvas(page, drivePoint, { x: drivePoint.x + 120, y: drivePoint.y - 80 })
      await settledFrames(page)

      const dragged = await requireCamera(page)
      expect(dragged.azimuth, 'the drag must turn the camera').not.toBe(camera.azimuth)
      expect(dragged.target).toEqual(expected.target)
    })
  }
}
