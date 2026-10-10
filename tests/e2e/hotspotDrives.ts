import type { Page } from '@playwright/test'
import { dragOnCanvas } from './stageCamera'
import { completedStage } from './stageSettle'
import { harnessCanvasDrivePoint, requireCamera } from './hotspotViews'
import type { Point3 } from './hotspotPlacement'

// The camera drives of the hotspot specs: the calibrated drag to an azimuth
// or a polar, the hiding view they compose into, and the wheel to a distance
// band. Every pass re-measures and waits for the rest, ordered by reads,
// never by time. The reads and expectations they serve live in
// hotspotViews.ts.

// The tolerance of the drag-driven views, azimuth and polar alike: each
// pass re-measures and corrects, so the loop converges from any angle; the
// tolerance only bounds how close to the geometric view the loop must land.
// Ten degrees keeps the occlusion argument whole, because the anchor
// sits at the orbit center's opposite.
const driveTolerance = Math.PI / 18

// The drag length bounds of one correcting pass. The floor keeps a drag
// short enough to question from registering as none, and it must stay below
// the tightest drive tolerance's own travel: the hiding polar tolerance
// (PI/120) is about 3 px of orbit at the turn rate of a full turn per stage
// height, so a floor above that could step over the band and oscillate
// around the target forever. The cap bounds a single pass on any engine.
const minDragPx = 4
const maxDragPx = 480

// The pass budget: a calibrated drive converges geometrically, in a handful
// of passes per half turn on the fastest engine and a dozen on the slowest;
// four times that bound is the limit, so a regression in engine
// responsiveness fails the drive instead of the test's own timeout.
const dragPassLimit = 48

// The damping of a proportional step: each pass aims at four fifths of the
// remaining error, so a pass can never turn exactly the error and stall the
// loop on its own boundary.
const driveDamping = 0.8

// The wrapped angle from the first angle to the second, in [-PI, PI].
function angleTo(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// One calibration drag measures this engine's turn per pixel for one axis.
// The controls apply a drag per rendered frame, so the software-rendered
// engines turn an order of magnitude less per pixel than the hardware ones
// (a 240 px drag turned 120 degrees on chrome and 15 degrees on the Windows
// WebKit build, both measured), and a fixed step sized for one engine
// either oscillates on the other or crawls. The calibration drag is half
// the camera suite's standard 240 px drag, well inside a half turn
// everywhere.
async function calibrateTurnRate(page: Page, axis: 'x' | 'y'): Promise<number> {
  const center = await harnessCanvasDrivePoint(page)
  const before = await requireCamera(page)
  const stepPx = 120
  if (axis === 'x') {
    await dragOnCanvas(page, center, { x: center.x + stepPx, y: center.y })
  } else {
    await dragOnCanvas(page, center, { x: center.x, y: center.y - stepPx })
  }
  await completedStage(page)
  const after = await requireCamera(page)
  if (axis === 'x') {
    const turned = Math.abs(angleTo(before.azimuth, after.azimuth))
    return turned / stepPx
  }
  return Math.abs(after.polar - before.polar) / stepPx
}

// Drags the camera until its azimuth stands at the target, within the
// tolerance. A calibration drag measures this engine's turn per pixel, and
// each pass aims a damped proportional step at the remaining error, so the
// same drive converges on the fastest and the slowest engine. Every pass
// re-measures and waits for the rest, ordered by reads, never by time.
export async function dragToAzimuth(page: Page, targetAzimuth: number): Promise<void> {
  const center = await harnessCanvasDrivePoint(page)
  const rate = await calibrateTurnRate(page, 'x')
  for (let pass = 0; pass < dragPassLimit; pass += 1) {
    const camera = await requireCamera(page)
    const error = angleTo(camera.azimuth, targetAzimuth)
    if (Math.abs(error) <= driveTolerance) {
      return
    }
    // Dragging right turns the azimuth down (the camera suite's sign
    // check), so an error above zero, a camera that must turn up, is
    // corrected by a leftward drag.
    const dragPx = Math.min(
      maxDragPx,
      Math.max(minDragPx, Math.round((driveDamping * Math.abs(error)) / rate)),
    )
    const direction = error > 0 ? -1 : 1
    await dragOnCanvas(page, center, { x: center.x + direction * dragPx, y: center.y })
    await completedStage(page)
  }
  const camera = await requireCamera(page)
  const error = angleTo(camera.azimuth, targetAzimuth)
  throw new Error(
    `the camera did not reach the target azimuth in ${dragPassLimit} passes: off by ${error.toFixed(3)} rad`,
  )
}

// The opposite azimuth of the anchor through the orbit target: the camera
// direction that puts the body between the camera and the anchor. The
// anchor comes as the probe's live position, which is a point already.
export function oppositeAzimuthOf(camera: { readonly target: Point3 }, anchor: Point3): number {
  return Math.atan2(-(anchor.x - camera.target.x), -(anchor.z - camera.target.z))
}

// Drags the camera up until its polar stands at least at the target, within
// the tolerance. Dragging up raises the polar (the camera suite's direction
// check), so the camera comes down toward and past the orbit target's
// height.
export async function dragToPolarAtLeast(page: Page, minPolar: number): Promise<void> {
  const center = await harnessCanvasDrivePoint(page)
  const rate = await calibrateTurnRate(page, 'y')
  for (let pass = 0; pass < dragPassLimit; pass += 1) {
    const camera = await requireCamera(page)
    if (camera.polar >= minPolar - driveTolerance) {
      return
    }
    const dragPx = Math.min(
      maxDragPx,
      Math.max(minDragPx, Math.round((driveDamping * (minPolar - camera.polar)) / rate)),
    )
    await dragOnCanvas(page, center, { x: center.x, y: center.y - dragPx })
    await completedStage(page)
  }
  const camera = await requireCamera(page)
  throw new Error(
    `the camera did not reach the polar ${minPolar.toFixed(3)} in ${dragPassLimit} passes: at ${camera.polar.toFixed(3)}`,
  )
}

// The reverse of dragToPolarAtLeast: drags down until the polar stands at
// most at the target, so the camera climbs back to a higher view.
export async function dragToPolarAtMost(page: Page, maxPolar: number): Promise<void> {
  const center = await harnessCanvasDrivePoint(page)
  const rate = await calibrateTurnRate(page, 'y')
  for (let pass = 0; pass < dragPassLimit; pass += 1) {
    const camera = await requireCamera(page)
    if (camera.polar <= maxPolar + driveTolerance) {
      return
    }
    const dragPx = Math.min(
      maxDragPx,
      Math.max(minDragPx, Math.round((driveDamping * (camera.polar - maxPolar)) / rate)),
    )
    await dragOnCanvas(page, center, { x: center.x, y: center.y + dragPx })
    await completedStage(page)
  }
  const camera = await requireCamera(page)
  throw new Error(
    `the camera did not climb back to the polar ${maxPolar.toFixed(3)} in ${dragPassLimit} passes: at ${camera.polar.toFixed(3)}`,
  )
}

// The polar tolerance of the hiding view. The camera height moves by about
// the distance times the sine of the error at these polars: at the home
// distance and this tolerance, about two centimeters of height, well inside
// the hiding view's margins (the flank entry sits millimeters below the top
// face, and the other anchors clear the box by tens of millimeters).
const hidingPolarTolerance = Math.PI / 120

// Drags the camera until its polar stands at the target, within the tight
// hiding-view tolerance. Dragging up raises the polar (the camera suite's
// direction check).
export async function driveToPolar(page: Page, targetPolar: number): Promise<void> {
  const center = await harnessCanvasDrivePoint(page)
  const rate = await calibrateTurnRate(page, 'y')
  for (let pass = 0; pass < dragPassLimit; pass += 1) {
    const camera = await requireCamera(page)
    const error = targetPolar - camera.polar
    if (Math.abs(error) <= hidingPolarTolerance) {
      return
    }
    // Dragging up raises the polar (the camera suite's direction check).
    const dragPx = Math.min(
      maxDragPx,
      Math.max(minDragPx, Math.round((driveDamping * Math.abs(error)) / rate)),
    )
    const direction = error > 0 ? -1 : 1
    await dragOnCanvas(page, center, { x: center.x, y: center.y + direction * dragPx })
    await completedStage(page)
  }
  const camera = await requireCamera(page)
  const error = targetPolar - camera.polar
  throw new Error(
    `the camera did not reach the polar ${targetPolar.toFixed(3)} in ${dragPassLimit} passes: off by ${error.toFixed(4)} rad`,
  )
}

// The hiding view: the target azimuth at the target polar, which the
// caller derives from the model facts. The reached view is then held
// against its two geometric facts: the occluded anchor's segment enters
// the box, and the other anchors' segments miss it.
export async function driveToHidingView(
  page: Page,
  targetAzimuth: number,
  targetPolar: number,
): Promise<void> {
  await dragToAzimuth(page, targetAzimuth)
  await driveToPolar(page, targetPolar)
}

// The pass budget of the wheel-driven zoom to a distance band. One wheel
// step of the suite's 240 dollies the orbit distance by a factor of about
// 1.008 (measured on this suite: 48 passes from the close-up distance
// reached 0.547 of the home 1.058), so a close-up that starts under half
// the band needs about 121 passes to double its way in; the budget bounds
// a regression, not the wait.
const zoomPassLimit = 160

// The wheel direction: wheel out dollies away from the product (the camera
// suite's clamp check), wheel in toward it.
const WHEEL_STEP = 240

// Wheels the camera until its orbit distance stands inside the band, each
// pass read-driven: read the camera, wheel one step toward the band, wait
// for the rest. Ordered by reads, never by time. The wheel needs the canvas
// under the pointer: the markers and the open card hug the product at the
// center of the view and swallow the wheel events, so the wheel rolls from
// a point inside the canvas that no marker of the presented product covers.
export async function zoomToDistanceBand(
  page: Page,
  band: { readonly min: number; readonly max: number },
): Promise<void> {
  const wheelPoint = await harnessCanvasDrivePoint(page)
  await page.mouse.move(wheelPoint.x, wheelPoint.y)
  for (let pass = 0; pass < zoomPassLimit; pass += 1) {
    const camera = await requireCamera(page)
    if (camera.distance >= band.min && camera.distance <= band.max) {
      return
    }
    await page.mouse.wheel(0, camera.distance < band.min ? WHEEL_STEP : -WHEEL_STEP)
    await completedStage(page)
  }
  const camera = await requireCamera(page)
  throw new Error(
    `the camera did not reach the distance band [${band.min}, ${band.max}] in ${zoomPassLimit} passes: at ${camera.distance}`,
  )
}
