import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { dragOnCanvas, readCamera } from './stageCamera'
import { settledFrames } from './stageSettle'
import { harnessStageBox } from './lookHarness'
import { isInsideBox, projectToStageBox, type Point3 } from './hotspotPlacement'
import type { ProductHotspotFacts } from './productHotspots'

// The view helpers of the hotspot specs: the camera and probe reads, the
// drag drive to an azimuth, and the expectations that hold the marker DOM
// against geometry the viewer does not compute. One module, so both spec
// files read the same drive and the same expectations.

// The placement epsilon and where it comes from: both sides project in
// double precision and differ by a few ulps of the stage size, but the
// browser lays the marker out on a 1/64 px grid, so the marker's box center
// is quantized by up to 1/64 px (0.0156) per axis. The bound is a little
// over twice that, plus the float noise, and nothing else.
export const stagePixelEpsilon = 0.05

// The tolerance of the drag-driven views, azimuth and polar alike: each
// pass re-measures and corrects, so the loop converges from any angle; the
// tolerance only bounds how close to the geometric view the loop must land.
// Ten degrees keeps the occlusion argument whole, because the anchor
// sits at the orbit center's opposite.
const driveTolerance = Math.PI / 18

// The drag length bounds of one correcting pass. The floor keeps a small
// residual error from producing a drag too short to register as one; the
// cap bounds a single pass on any engine.
const minDragPx = 8
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

// One calibration drag measures this engine's turn per pixel for one axis.
// The controls apply a drag per rendered frame, so the software-rendered
// engines turn an order of magnitude less per pixel than the hardware ones
// (a 240 px drag turned 120 degrees on chrome and 15 degrees on the Windows
// WebKit build, both measured), and a fixed step sized for one engine
// either oscillates on the other or crawls. The calibration drag is half
// the camera suite's standard 240 px drag, well inside a half turn
// everywhere.
async function calibrateTurnRate(page: Page, axis: 'x' | 'y'): Promise<number> {
  const center = await harnessCanvasCenter(page)
  const before = await requireCamera(page)
  const stepPx = 120
  if (axis === 'x') {
    await dragOnCanvas(page, center, { x: center.x + stepPx, y: center.y })
  } else {
    await dragOnCanvas(page, center, { x: center.x, y: center.y - stepPx })
  }
  await settledFrames(page)
  const after = await requireCamera(page)
  if (axis === 'x') {
    const turned = Math.abs(angleTo(before.azimuth, after.azimuth))
    return turned / stepPx
  }
  return Math.abs(after.polar - before.polar) / stepPx
}

export function requireCamera(page: Page) {
  return readCamera(page).then((camera) => {
    if (camera === null) {
      throw new Error('the live stage camera must be readable once a view is presented')
    }
    return camera
  })
}

export function requireHotspots(page: Page) {
  return page
    .evaluate(() => window.__viewer?.hotspots ?? null)
    .then((hotspots) => {
      if (hotspots === null) {
        throw new Error('the hotspots probe must be registered while the product is on the stage')
      }
      return hotspots
    })
}

// The wrapped angle from the first angle to the second, in [-PI, PI].
function angleTo(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// The center of the harness stage canvas, in page coordinates. The harness
// page has no stage slot; its canvas is the stage's own box.
export async function harnessCanvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await harnessStageBox(page)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Drags the camera until its azimuth stands at the target, within the
// tolerance. A calibration drag measures this engine's turn per pixel, and
// each pass aims a damped proportional step at the remaining error, so the
// same drive converges on the fastest and the slowest engine. Every pass
// re-measures and waits for the rest, ordered by reads, never by time.
export async function dragToAzimuth(page: Page, targetAzimuth: number): Promise<void> {
  const center = await harnessCanvasCenter(page)
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
    await settledFrames(page)
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
  const center = await harnessCanvasCenter(page)
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
    await settledFrames(page)
  }
  const camera = await requireCamera(page)
  throw new Error(
    `the camera did not reach the polar ${minPolar.toFixed(3)} in ${dragPassLimit} passes: at ${camera.polar.toFixed(3)}`,
  )
}

// The reverse of dragToPolarAtLeast: drags down until the polar stands at
// most at the target, so the camera climbs back to a higher view.
export async function dragToPolarAtMost(page: Page, maxPolar: number): Promise<void> {
  const center = await harnessCanvasCenter(page)
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
    await settledFrames(page)
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
  const center = await harnessCanvasCenter(page)
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
    await settledFrames(page)
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

export function markerOf(page: Page, title: string) {
  return page.getByRole('button', { name: title })
}

export function titleOf(
  product: { readonly hotspots: readonly { readonly id: string; readonly title: string }[] },
  id: string,
): string {
  const title = product.hotspots.find((hotspot) => hotspot.id === id)?.title
  if (title === undefined) {
    throw new Error(`no manifest hotspot '${id}'`)
  }
  return title
}

// The anchor a body can hide: the one whose authored position lies inside
// the occluding meshes' bounds, found by geometry, not by name.
export function occludableFact(facts: ProductHotspotFacts) {
  const fact = facts.hotspots.find((entry) =>
    isInsideBox(pointOf(entry.stagePosition), factsBoundsOf(facts)),
  )
  if (fact === undefined) {
    throw new Error('no hotspot anchor lies inside the body bounds to occlude')
  }
  return fact
}

// The facts' occluder bounds as points, so the geometry helpers read one
// shape.
export function factsBoundsOf(facts: ProductHotspotFacts): {
  readonly min: Point3
  readonly max: Point3
} {
  return { min: pointOf(facts.occluderBounds.min), max: pointOf(facts.occluderBounds.max) }
}

export function pointOf(tuple: readonly [number, number, number]): Point3 {
  const [x, y, z] = tuple
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error('a model fact arrived with a short position')
  }
  return { x, y, z }
}

// Every listed hotspot's marker against the projection of the anchor the
// probe reports right now, read once for all of them.
export async function expectMarkersAtProjection(
  page: Page,
  hotspots: readonly { readonly id: string; readonly title: string }[],
  why: string,
): Promise<void> {
  const probe = await requireHotspots(page)
  for (const hotspot of hotspots) {
    const anchor = probe.hotspots.find((entry) => entry.id === hotspot.id)
    if (anchor === undefined) {
      throw new Error(`the probe answers no anchor for ${hotspot.id}`)
    }
    await expectMarkerAtProjection(page, hotspot.title, anchor.position, `${hotspot.id} ${why}`)
  }
}

// The marker's box center against the projection of the anchor the probe
// reports, through this module's own projection.
export async function expectMarkerAtProjection(
  page: Page,
  title: string,
  anchor: Point3,
  why: string,
): Promise<void> {
  const camera = await requireCamera(page)
  const canvas = await harnessStageBox(page)
  const box = await markerOf(page, title).boundingBox()
  if (box === null) {
    throw new Error(`the marker '${title}' must have a bounding box`)
  }
  const projected = projectToStageBox(camera, anchor, canvas)
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  expect(
    Math.abs(centerX - (canvas.x + projected.x)),
    `${why}: marker x ${centerX} against projection ${canvas.x + projected.x}`,
  ).toBeLessThanOrEqual(stagePixelEpsilon)
  expect(
    Math.abs(centerY - (canvas.y + projected.y)),
    `${why}: marker y ${centerY} against projection ${canvas.y + projected.y}`,
  ).toBeLessThanOrEqual(stagePixelEpsilon)
}

// A marker hidden by the visibility rule is invisible, unfocusable and
// unclickable: it takes no focus through script, and the point it would sit
// at hands events to whatever sits under the overlay. The element is
// located with includeHidden, because a hidden element leaves the role tree
// and the check is about exactly that state.
export async function expectHiddenEverywhere(
  page: Page,
  title: string,
  why: string,
): Promise<void> {
  const marker = page.getByRole('button', { name: title, includeHidden: true })
  await expect(marker, `${why}: ${title} must be hidden`).toBeHidden()
  // The verdicts compute inside the page: a DOM element does not survive
  // the evaluate boundary, so the page answers with facts about it.
  const state = await marker.evaluate((element) => {
    element.focus()
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return {
      focused: document.activeElement === element,
      hasTopElement: top !== null,
      topIsButton: top !== null && top.closest('button') !== null,
    }
  })
  expect(state.focused, `${why}: ${title} must not take focus while hidden`).toBe(false)
  expect(
    state.hasTopElement,
    `${why}: the hidden marker's point must still hand events somewhere`,
  ).toBe(true)
  expect(state.topIsButton, `${why}: no button may take the hidden marker's point`).toBe(false)
}
