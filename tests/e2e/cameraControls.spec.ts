import { testBodyBudgetMs } from './budgets'
import { expect, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { settledFrames, settledStage } from './stageSettle'
import { waitForProductReady } from './productSpecs'
import { resolvedTokenColor } from './tokenColor'
import {
  canvasCenter,
  dragOnCanvas,
  readCamera,
  resolvedDistanceRange,
  REST_THRESHOLD,
} from './stageCamera'
import { expectUnavailable } from './stageKeys'
// The collection's first product, and its authored camera facts read from
// the shipped `.glb`.
const first = (await loadCollection()).first
const facts = await readProductCameraFacts(first.slug)

const zoomIn = (page: Page): Locator => page.getByRole('button', { name: siteCopy.zoomInLabel })
const zoomOut = (page: Page): Locator => page.getByRole('button', { name: siteCopy.zoomOutLabel })

async function readyStage(page: Page, backendPath: string): Promise<void> {
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)
}

function requireCamera(page: Page) {
  return readCamera(page).then((camera) => {
    if (camera === null) {
      throw new Error('the live stage camera must be readable once a view is presented')
    }
    return camera
  })
}

test('a drag rotates the camera around the product and comes to rest', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const before = await readCamera(page)
  if (before === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }

  const framesBefore = await settledFrames(page)
  await dragOnCanvas(page, center, { x: center.x + 240, y: center.y })
  await settledFrames(page)

  const after = await readCamera(page)
  if (after === null) {
    throw new Error('the live stage camera must stay readable')
  }

  // The sign: dragging right decreases the controls' azimuth angle, so the
  // product follows the hand and its front swings toward the pointer.
  expect(
    after.azimuth,
    `dragging right must decrease the azimuth (before ${before.azimuth}, after ${after.azimuth})`,
  ).toBeLessThan(before.azimuth)
  // The size: the drag turns the camera by its whole pointer travel, on every
  // engine and under any load, by the controls' own rule of a full turn per
  // stage height of travel at the default rotate speed of 1
  // (camera-controls dist/camera-controls.module.js, `_rotateInternal`:
  // theta = PI_2 * azimuthRotateSpeed * deltaX / elementRect.height). At rest
  // the controls snap the eased angle onto its end (`update`: approxZero
  // sets theta to the end theta), so the only inexactness is the float sum
  // of the drag's steps, a few ulps of the angle.
  const canvasBox = await page.locator('[data-slot="stage"] canvas').boundingBox()
  if (canvasBox === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  const travelTurn = (2 * Math.PI * 240) / canvasBox.height
  expect(
    Math.abs(before.azimuth - after.azimuth - travelTurn),
    `the drag must turn the camera by its whole travel (${travelTurn} rad), turned ${before.azimuth - after.azimuth}`,
  ).toBeLessThanOrEqual(1e-9)
  // A horizontal drag turns without lifting: the polar angle stays.
  expect(after.polar).toBeCloseTo(before.polar, 1)
  // The orbit target never moves: a drag is a turn, not a pan.
  expect(after.target.x).toBeCloseTo(before.target.x, 9)
  expect(after.target.y).toBeCloseTo(before.target.y, 9)
  expect(after.target.z).toBeCloseTo(before.target.z, 9)
  // The stage rendered for the drag and is at rest again: no frames run
  // between two reads across the settle window.
  expect(await settledFrames(page)).toBeGreaterThan(framesBefore)
})

test('the wheel zooms and both directions stop exactly at the limits', async ({
  page,
  backendPath,
}) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  await page.mouse.move(center.x, center.y)

  // Wheel out until the clamp holds the camera: the distance rests at the
  // maximum, within the controls' rest threshold.
  for (let wheel = 0; wheel < 15; wheel += 1) {
    await page.mouse.wheel(0, 240)
  }
  await settledFrames(page)
  const outmost = await readCamera(page)
  if (outmost === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(
    Math.abs(outmost.distance - outmost.maxDistance),
    'wheel out must stop at the maximum distance, within the rest threshold',
  ).toBeLessThanOrEqual(REST_THRESHOLD)

  // Wheel in until the other clamp: the distance rests at the minimum.
  for (let wheel = 0; wheel < 25; wheel += 1) {
    await page.mouse.wheel(0, -240)
  }
  await settledFrames(page)
  const innermost = await readCamera(page)
  if (innermost === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(
    Math.abs(innermost.distance - innermost.minDistance),
    'wheel in must stop at the minimum distance, within the rest threshold',
  ).toBeLessThanOrEqual(REST_THRESHOLD)

  // The wheel never turns the camera: both angles are the home ones.
  expect(innermost.azimuth).toBeCloseTo((facts.home.azimuthDegrees * Math.PI) / 180, 1)
  expect(innermost.polar).toBeCloseTo((facts.home.polarDegrees * Math.PI) / 180, 1)
})

test('a drag stops exactly at the polar limits, top and bottom', async ({ page, backendPath }) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const maxPolar = (stageCameraConfig.maxPolarAngleDegrees * Math.PI) / 180
  const minPolar = (stageCameraConfig.minPolarAngleDegrees * Math.PI) / 180

  // One drag applies one move per rendered frame, and how many frames a
  // drag gets depends on the backend's speed, so the test drags until the
  // clamp holds, within a bound well past the need. Dragging up raises the
  // polar angle toward the configured floor-side limit, which the controls
  // clamp at.
  const dragToPolarClamp = async (up: boolean): Promise<number> => {
    const limit = up ? maxPolar : minPolar
    let polar = (await requireCamera(page)).polar
    for (let pass = 0; pass < 12 && Math.abs(polar - limit) > REST_THRESHOLD; pass += 1) {
      await dragOnCanvas(page, center, { x: center.x, y: center.y + (up ? -400 : 400) })
      await settledFrames(page)
      polar = (await requireCamera(page)).polar
    }
    return polar
  }

  const shallowest = await dragToPolarClamp(true)
  expect(
    Math.abs(shallowest - maxPolar),
    'dragging up must stop at the maximum polar angle, within the rest threshold',
  ).toBeLessThanOrEqual(REST_THRESHOLD)

  // Dragging down lowers it toward the top-side limit.
  const steepest = await dragToPolarClamp(false)
  expect(
    Math.abs(steepest - minPolar),
    'dragging down must stop at the minimum polar angle, within the rest threshold',
  ).toBeLessThanOrEqual(REST_THRESHOLD)
})

test('neither a right drag nor a shift drag pans the camera', async ({ page, backendPath }) => {
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const before = await readCamera(page)
  if (before === null) {
    throw new Error('the live stage camera must be readable')
  }

  await page.mouse.move(center.x, center.y)
  await page.mouse.down({ button: 'right' })
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(center.x + step * 30, center.y + step * 20)
  }
  await page.mouse.up({ button: 'right' })
  await settledFrames(page)

  const afterRight = await readCamera(page)
  if (afterRight === null) {
    throw new Error('the live stage camera must be readable')
  }
  // The right button is bound to nothing: neither the target nor the
  // angles move.
  expect(afterRight.target.x).toBeCloseTo(before.target.x, 9)
  expect(afterRight.target.y).toBeCloseTo(before.target.y, 9)
  expect(afterRight.target.z).toBeCloseTo(before.target.z, 9)
  expect(afterRight.azimuth).toBeCloseTo(before.azimuth, 6)
  expect(afterRight.polar).toBeCloseTo(before.polar, 6)

  await page.keyboard.down('Shift')
  await dragOnCanvas(page, center, { x: center.x + 200, y: center.y })
  await page.keyboard.up('Shift')
  await settledFrames(page)

  const afterShift = await readCamera(page)
  if (afterShift === null) {
    throw new Error('the live stage camera must be readable')
  }
  // A shift drag may turn, but never pan: the target stays put.
  expect(afterShift.target.x).toBeCloseTo(before.target.x, 9)
  expect(afterShift.target.y).toBeCloseTo(before.target.y, 9)
  expect(afterShift.target.z).toBeCloseTo(before.target.z, 9)
})

test('the zoom buttons move the percentage by one step and wait unavailable at their limits', async ({
  page,
  backendPath,
}) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  await readyStage(page, backendPath)
  const readout = page.locator('[data-corner="bottom-right"]')
  // The percentages the readout steps through: the home percentage of the
  // product's resolved distance limits, moved by one config step per press,
  // clamped to the percent scale at both ends.
  const step = stageCameraConfig.zoomStepPercent
  const range = resolvedDistanceRange(first, facts.home.distance)
  const homePercent = ((range.max - facts.home.distance) / (range.max - range.min)) * 100

  // The readout shows the exact percent of the live distance, rounded to
  // the integer. The live distance rests within the controls' rest
  // threshold of the move's end (REST_THRESHOLD, cited in stageCamera.ts),
  // which maps to the percent points below at this product's range, so the
  // shown integer may sit one point of the readout away from the exact end
  // percent: the bound is that threshold's own size plus the rounding, not
  // a tuned number.
  const restPercentPoints = (REST_THRESHOLD / (range.max - range.min)) * 100
  const shownPercent = async (): Promise<number> => {
    const text = await readout.innerText()
    const match = /(\d+)%/.exec(text)
    if (match === null) {
      throw new Error(`the zoom readout shows no percentage: '${text}'`)
    }
    return Number(match[1])
  }
  const expectShownPercent = (percent: number, why: string) => {
    return expect
      .poll(async () => Math.abs((await shownPercent()) - percent), {
        message: why,
        timeout: testBodyBudgetMs,
      })
      .toBeLessThanOrEqual(Math.ceil(restPercentPoints))
  }

  // Inside the limits both buttons work: the home percent is strictly
  // between the ends, so either step moves the camera.
  await expectShownPercent(homePercent, 'the readout shows the home percent')
  await expect(zoomIn(page)).toBeEnabled()
  await expect(zoomOut(page)).toBeEnabled()

  await zoomIn(page).click()
  await expectShownPercent(homePercent + step, 'one press moves the readout one step')
  await zoomIn(page).click()
  await expectShownPercent(homePercent + 2 * step, 'the second press moves one step again')
  // The step clamps at 100: one more press reaches the limit.
  await zoomIn(page).click()
  await expectShownPercent(100, 'the third press clamps at the minimum distance')

  // At the limit the camera's own state says so: zoom in has reached the
  // minimum distance, and its button waits unavailable, in the one disabled
  // color the waiting controls share, still in the tab order.
  const disabledColor = await resolvedTokenColor(page, '--disabled')
  await expectUnavailable(zoomIn(page))
  await expect(zoomOut(page)).toBeEnabled()
  await expect(zoomIn(page)).toHaveCSS('color', disabledColor)
  // The button state reads the move's end, which is exact at the limit
  // before the live distance has finished easing into it; the read waits
  // for the rest the way every live-camera check does.
  await settledFrames(page)
  const fullest = await readCamera(page)
  if (fullest === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(Math.abs(fullest.distance - fullest.minDistance)).toBeLessThanOrEqual(REST_THRESHOLD)

  // Back down through the same steps to the other clamp.
  await zoomOut(page).click()
  await expectShownPercent(100 - step, 'one press out moves the readout one step')
  await expect(zoomIn(page)).toBeEnabled()
  const remainingOutSteps = Math.ceil((100 - step) / step)
  for (let press = 0; press < remainingOutSteps; press += 1) {
    await zoomOut(page).click()
  }
  await expectShownPercent(0, 'the presses out clamp at the maximum distance')

  // At the outer limit zoom out waits, and its inward twin works again.
  await expectUnavailable(zoomOut(page))
  await expect(zoomIn(page)).toBeEnabled()
  await expect(zoomOut(page)).toHaveCSS('color', disabledColor)
  await settledFrames(page)
  const emptiest = await readCamera(page)
  if (emptiest === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(Math.abs(emptiest.distance - emptiest.maxDistance)).toBeLessThanOrEqual(REST_THRESHOLD)
})
