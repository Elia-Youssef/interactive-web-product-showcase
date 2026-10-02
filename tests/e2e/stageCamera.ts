import { expect, type Page } from '@playwright/test'
import { testBodyBudgetMs } from './budgets'
import type { ProductCameraFacts } from './productCamera'
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
// (camera-controls dist/camera-controls.module.js, `restThreshold = 0.01`.)
export const REST_THRESHOLD = 0.01

// The aspect rule of the stage camera: when the stage is narrower than the
// authored aspect, every distance scales by authoredAspect over
// stageAspect; otherwise it is 1.
export function containedScale(authoredAspect: number, stageAspect: number): number {
  return stageAspect < authoredAspect ? authoredAspect / stageAspect : 1
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

// The home expectation of one product at one stage aspect. The distance
// limits are the camera config's ratios of the authored home distance,
// scaled by the aspect rule; the zoom percentage is the same linear map
// the readout applies, at the distance the home view keeps.
export function homeExpectation(facts: ProductCameraFacts, stageAspect: number) {
  const scale = containedScale(facts.home.aspect, stageAspect)
  const distance = facts.home.distance * scale
  const target: Point = {
    x: facts.home.target[0],
    y: facts.home.target[1],
    z: facts.home.target[2],
  }
  const minDistance = facts.home.distance * stageCameraConfig.minHomeDistanceRatio * scale
  const maxDistance = facts.home.distance * stageCameraConfig.maxHomeDistanceRatio * scale
  return {
    position: positionOfOrbit(facts.home.azimuthDegrees, facts.home.polarDegrees, distance, target),
    target,
    fovY: facts.home.fovY,
    distance,
    minDistance,
    maxDistance,
    zoomPercent: ((maxDistance - distance) / (maxDistance - minDistance)) * 100,
  }
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
// with every step delivered after the frame the previous step owed, the way
// a real pointer moves over time. camera-controls applies a drag at most
// once per frame (its update re-arms the drag) and, at the release, drops
// every move since the last applied one (camera-controls
// dist/camera-controls.module.js, `update`: `_dragNeedsUpdate = true`, and
// `endDragging`). A script that moves faster than the stage presents would
// turn the camera by however many frames happened to land inside the drag,
// which differs by engine and by machine load. An applied step dispatches the
// controls' control event, which invalidates the stage, so each step owes
// exactly the one frame the next step waits for, and the drag turns the
// camera by its whole travel on every engine.
export async function dragOnCanvas(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    const framesBeforeStep = await renderedFrames(page)
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / DRAG_STEPS,
      from.y + ((to.y - from.y) * step) / DRAG_STEPS,
    )
    await expect
      .poll(() => renderedFrames(page), {
        message: 'every drag step must present the frame it owes',
        timeout: testBodyBudgetMs,
      })
      .toBeGreaterThan(framesBeforeStep)
  }
  await page.mouse.up()
}

// The center of the stage canvas, in page coordinates.
export async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-slot="stage"] canvas').boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
