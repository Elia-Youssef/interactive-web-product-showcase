import { expect, type Page } from '@playwright/test'
import { testBodyBudgetMs } from './budgets'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import { resolvedDistanceLimits, type DistanceRange } from '../../src/lib/camera/limits'
import type { Product } from '../../src/lib/product'
import { stageCameraConfig } from '../../src/viewer/camera/config'

// The stage camera's expectations, computed in the test from the authored
// facts: the aspect rule, the orbit position of the home view at one stage
// aspect, and the page-side reads of the live camera and readouts. This
// module restates the two design rules it checks (the aspect rule and the
// spherical convention) instead of importing the viewer's math, so a viewer
// regression cannot hide behind its own helpers.

export type CameraRead = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly target: { readonly x: number; readonly y: number; readonly z: number }
  readonly fovY: number
  readonly azimuth: number
  readonly polar: number
  readonly distance: number
  readonly minDistance: number
  readonly maxDistance: number
}

export type Point = { readonly x: number; readonly y: number; readonly z: number }

// The inexactness every live-camera check carries: the controls rest when
// every remaining delta to the end state is below this threshold, so the
// live position and distance sit this far from the authored values at
// rest. The end state itself is exact.
// (camera-controls dist/camera-controls.module.js:481, `restThreshold = 0.01`;
// the rotate and dolly rest checks pass it to approxEquals per component,
// :1428 to :1429 and :1471.)
export const REST_THRESHOLD = 0.01

// The float bound of a fraction compared against the one-step rule below:
// the controls' recurrence and the rule run the same arithmetic in two
// float paths, so their results differ by a few ulps of one. Measured
// across the eased moves, the gap stays below nine ulps; the bound is the
// next power of two of one's ulp.
export const ONE_STEP_FLOAT_GAP = 16 * Number.EPSILON

// The fraction of its change one eased step from rest moves, with
// x = 2 dt / smoothTime: the step leaves (1 + x) over
// (1 + x + 0.48 x^2 + 0.235 x^3) of the change, the velocity term
// included (camera-controls dist/camera-controls.module.js, smoothDamp).
// Restated here like the orbit math above, so a viewer regression cannot
// hide behind its own helper.
export function oneStepFractionFromRest(smoothTimeSeconds: number, dtSeconds: number): number {
  const x = (2 * dtSeconds) / smoothTimeSeconds
  return 1 - (1 + x) / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
}

// One eased step of an angle channel, restated from camera-controls'
// smoothDamp (dist/camera-controls.module.js) including its velocity term
// and its overshoot guard, so a replay of a running move can be compared
// against the viewer's per-frame reads.
export function easedAngleStep(options: {
  readonly currentRadians: number
  readonly endRadians: number
  readonly velocityRadiansPerSecond: number
  readonly smoothTimeSeconds: number
  readonly dtSeconds: number
}): { readonly angleRadians: number; readonly velocityRadiansPerSecond: number } {
  const { currentRadians, endRadians, velocityRadiansPerSecond, smoothTimeSeconds, dtSeconds } =
    options
  const smoothTime = Math.max(0.0001, smoothTimeSeconds)
  const omega = 2 / smoothTime
  const x = omega * dtSeconds
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = currentRadians - endRadians
  const temp = (velocityRadiansPerSecond + omega * change) * dtSeconds
  const velocity = (velocityRadiansPerSecond - omega * temp) * exp
  const angle = endRadians + (change + temp) * exp
  // The overshoot guard, the source's own: a step that would cross the end
  // lands on it and carries the crossing as velocity.
  if (endRadians - currentRadians > 0 === angle > endRadians) {
    return { angleRadians: endRadians, velocityRadiansPerSecond: (endRadians - angle) / dtSeconds }
  }
  return { angleRadians: angle, velocityRadiansPerSecond: velocity }
}

// The two sides of a product's authored camera aspect a stage can sit on.
// The aspect rule scales every distance on the narrower side and leaves it
// unscaled on the other, so a proof of the rule needs a stage on each side;
// a stage on the wide side alone passes with a scale of exactly 1.
export const ASPECT_SIDES = ['narrower', 'atLeastAsWide'] as const
export type AspectSide = (typeof ASPECT_SIDES)[number]

const aspectSideWording: Record<AspectSide, string> = {
  narrower: 'narrower than',
  atLeastAsWide: 'at least as wide as',
}

export function describeAspectSide(side: AspectSide): string {
  return `stage ${aspectSideWording[side]} the authored camera aspect`
}

// The side of the authored aspect one stage aspect sits on.
export function aspectSideOf(authoredAspect: number, stageAspect: number): AspectSide {
  return stageAspect < authoredAspect ? 'narrower' : 'atLeastAsWide'
}

// The viewport for each side, either side of the tablet breakpoint. At the
// shared authored camera aspect of every product (1600 x 1422, about 1.125)
// the 1024 x 768 stage is about 0.904 wide per unit of height and the
// 768 x 1024 stage about 1.25. Every proof asserts its side on the measured
// stage through stageAspectOnSide, so a layout or authored aspect that moves
// a stage across fails by name instead of proving one side twice.
export const aspectSideViewports: Record<
  AspectSide,
  { readonly width: number; readonly height: number }
> = {
  narrower: { width: 1024, height: 768 },
  atLeastAsWide: { width: 768, height: 1024 },
}

// The measured stage aspect, once it is asserted to sit on the side of the
// authored aspect the proof needs.
export async function stageAspectOnSide(
  page: Page,
  authoredAspect: number,
  side: AspectSide,
): Promise<number> {
  const stageAspect = await stageAspectOfCanvas(page)
  expect(
    aspectSideOf(authoredAspect, stageAspect),
    `this proof needs a ${describeAspectSide(side)} (stage ${stageAspect}, authored ${authoredAspect})`,
  ).toBe(side)
  return stageAspect
}

// The lens a zoom presents through a base lens, the tangent half-angle
// rule the view lens rides the controls' zoom channel by, and its inverse,
// the zoom that presents a view lens through the base lens. The base lens
// is the plan's, the authored home view's. Restated here like the orbit
// math above, so a viewer regression cannot hide behind its own helper.
export function lensOfZoom(baseFovY: number, zoom: number): number {
  return 2 * Math.atan(Math.tan(baseFovY / 2) / zoom)
}

export function zoomOfLens(baseFovY: number, viewFovY: number): number {
  return Math.tan(baseFovY / 2) / Math.tan(viewFovY / 2)
}

// The lens band the rest threshold maps to at one view lens: an eased move
// rests with the zoom within REST_THRESHOLD of the zoom the view's lens
// maps to through the base lens, and this is the fov span that zoom error
// turns into around the view's lens. Every eased lens check compares
// against this band, derived from the library's threshold at the view's
// own zoom, never a tuned number; at the home view the zoom is 1.
export function lensBandAtRest(baseFovY: number, viewFovY: number): number {
  const zoomEnd = zoomOfLens(baseFovY, viewFovY)
  return Math.max(
    Math.abs(lensOfZoom(baseFovY, zoomEnd + REST_THRESHOLD) - viewFovY),
    Math.abs(lensOfZoom(baseFovY, zoomEnd - REST_THRESHOLD) - viewFovY),
  )
}

// The live lens after an eased move onto a view, held to the band the rest
// threshold maps to at that view's zoom.
export function expectLensAtRest(
  camera: CameraRead,
  baseFovY: number,
  viewFovY: number,
  why: string,
): void {
  expect(
    Math.abs(camera.fovY - viewFovY),
    `${why}: the lens must sit at the view's lens within the band of the rest threshold`,
  ).toBeLessThanOrEqual(lensBandAtRest(baseFovY, viewFovY))
}

// The aspect rule of the stage camera: when the stage is narrower than the
// authored aspect, every distance scales by authoredAspect over
// stageAspect; otherwise it is 1.
export function containedScale(authoredAspect: number, stageAspect: number): number {
  return aspectSideOf(authoredAspect, stageAspect) === 'narrower' ? authoredAspect / stageAspect : 1
}

// The camera position the home view names at one stage aspect: the authored
// azimuth and polar around the target, at the scaled distance. The spherical
// convention is the controls': azimuth around +Y from +Z, polar from +Y.
export function positionOfOrbit(
  azimuthDegrees: number,
  polarDegrees: number,
  distance: number,
  target: Point,
): Point {
  const azimuth = (azimuthDegrees * Math.PI) / 180
  const polar = (polarDegrees * Math.PI) / 180
  const sinPolar = Math.sin(polar)
  return {
    x: target.x + distance * sinPolar * Math.sin(azimuth),
    y: target.y + distance * Math.cos(polar),
    z: target.z + distance * sinPolar * Math.cos(azimuth),
  }
}

// The distance limits the camera enforces for one product at the authored
// aspect: each authored side of the manifest's camera block wins, a side it
// does not author is a ratio of the authored home distance, the same
// resolution the presented plan builds. Derived here from the manifest,
// never assumed from the fallback ratios, so a product with authored
// limits is under test unchanged.
export function resolvedDistanceRange(product: Product, homeDistance: number): DistanceRange {
  return resolvedDistanceLimits(product.camera ?? {}, homeDistance, {
    minRatio: stageCameraConfig.minHomeDistanceRatio,
    maxRatio: stageCameraConfig.maxHomeDistanceRatio,
  })
}

// The expectation of one authored view at one stage aspect: the orbit
// position at the scaled distance, the scaled limits, and the zoom
// percentage, the same linear map the readout applies, at the view's
// distance. The aspect in the rule is the authored aspect of the home
// camera, the one the plan carries for every view.
export function viewExpectation(
  view: AuthoredView,
  authoredAspect: number,
  range: DistanceRange,
  stageAspect: number,
) {
  const scale = containedScale(authoredAspect, stageAspect)
  const distance = view.distance * scale
  const target: Point = {
    x: view.target[0],
    y: view.target[1],
    z: view.target[2],
  }
  const minDistance = range.min * scale
  const maxDistance = range.max * scale
  return {
    position: positionOfOrbit(view.azimuthDegrees, view.polarDegrees, distance, target),
    target,
    fovY: view.fovY,
    // The authored orbit angles in radians, converted from the facts'
    // degrees: the same convention the controls use, azimuth around +Y
    // from +Z and polar from +Y.
    azimuth: (view.azimuthDegrees * Math.PI) / 180,
    polar: (view.polarDegrees * Math.PI) / 180,
    distance,
    minDistance,
    maxDistance,
    zoomPercent: ((maxDistance - distance) / (maxDistance - minDistance)) * 100,
  }
}

// The home expectation of one product at one stage aspect.
export function homeExpectation(facts: ProductCameraFacts, product: Product, stageAspect: number) {
  return viewExpectation(
    facts.home,
    facts.home.aspect,
    resolvedDistanceRange(product, facts.home.distance),
    stageAspect,
  )
}

// The wrapped angle difference from the first angle to the second, in
// [-PI, PI]: the controls accumulate full turns, an authored view does not.
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// The orbit at rest against an authored expectation. The controls rest when
// every remaining delta to the end state is below the threshold (see
// REST_THRESHOLD above), so each spherical component sits at most that far
// from the authored view, and no other tolerance enters.
export function expectOrbitAtRest(
  camera: CameraRead,
  expected: { readonly azimuth: number; readonly polar: number; readonly distance: number },
  why: string,
): void {
  expect(
    Math.abs(angleDelta(expected.azimuth, camera.azimuth)),
    `${why}: the azimuth must sit at the view within the rest threshold`,
  ).toBeLessThanOrEqual(REST_THRESHOLD)
  expect(
    Math.abs(camera.polar - expected.polar),
    `${why}: the polar must sit at the view within the rest threshold`,
  ).toBeLessThanOrEqual(REST_THRESHOLD)
  expect(
    Math.abs(camera.distance - expected.distance),
    `${why}: the distance must sit at the view within the rest threshold`,
  ).toBeLessThanOrEqual(REST_THRESHOLD)
}

// The live camera read, from the camera and the controls themselves.
export function readCamera(page: Page): Promise<CameraRead | null> {
  return page.evaluate(() => window.__viewer?.camera ?? null)
}

// The rendered frame count the stage's clock has recorded.
export function renderedFrames(page: Page): Promise<number> {
  return page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
}

// The stage aspect the renderer sees: the canvas box in CSS pixels, the box
// R3F hands the camera as its aspect.
export async function stageAspectOfCanvas(page: Page): Promise<number> {
  const canvas = page.locator('[data-slot="stage"] canvas')
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  return box.width / box.height
}

// The steps one drag moves in: enough that the controls see a drag, not a
// click.
const DRAG_STEPS = 8

// One drag of the pointer across the canvas: press, move in steps, release,
// with every step delivered after a frame that followed the previous step,
// the way a real pointer moves over time. camera-controls applies a pointer
// move only while its update has re-armed the drag since the last applied
// move, and, at the release, drops the movement since the last applied one
// (camera-controls dist/camera-controls.module.js: the `dragging` handler
// returns early unless `_dragNeedsUpdate`, `update` sets it, `endDragging`
// clears it). A step that arrives before the next update is skipped, and if
// it is the last one the release drops it, so the drag turns the camera by
// less than its travel.
//
// The frame each step waits for must therefore come after the step was
// handled, not merely after the step was sent: a frame the camera's own
// damping rendered between a read and the move would satisfy a count read
// before the move. So the count is recorded inside the page, by a
// capture-phase listener on the step's own pointermove, which runs in the
// same dispatch just before the controls' handler. The step's frame is any
// frame after that record: an applied step invalidates the stage through
// the controls' control event, so that frame always comes, and its update
// re-arms the drag before the next step is sent.
export async function dragOnCanvas(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    const framesAtStep = await recordFramesAtNextPointerMove(page)
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / DRAG_STEPS,
      from.y + ((to.y - from.y) * step) / DRAG_STEPS,
    )
    const handledAt = await framesAtStep.evaluate((record) => record.frames)
    await framesAtStep.dispose()
    await expect
      .poll(() => renderedFrames(page), {
        message: 'every drag step must present a frame after it was handled',
        timeout: testBodyBudgetMs,
      })
      .toBeGreaterThan(handledAt)
  }
  await page.mouse.up()
}

// Installs a one-shot capture listener for the page's next pointermove and
// hands back the recorded frame count as a promise inside a handle. The
// handle resolves only after the listener is installed, so the step that
// follows cannot be dispatched ahead of it.
function recordFramesAtNextPointerMove(page: Page) {
  return page.evaluateHandle(() => ({
    frames: new Promise<number>((resolve) => {
      window.addEventListener(
        'pointermove',
        () => {
          resolve(window.__viewer?.renderedFrames ?? -1)
        },
        { capture: true, once: true },
      )
    }),
  }))
}

// The center of the stage canvas, in page coordinates.
export async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-slot="stage"] canvas').boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
