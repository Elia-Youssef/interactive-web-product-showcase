import { expect, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { zoomReadoutText } from '../../src/features/stage-controls/stage-controls.logic'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { waitForProductReady } from './productSpecs'
import { settledFrames, settledStage } from './stageSettle'
import {
  canvasCenter,
  dragOnCanvas,
  homeExpectation,
  readCamera,
  REST_THRESHOLD,
  stageAspectOfCanvas,
} from './stageCamera'
// Reset and the chrome's controls contract: the eased return to the home
// view, its instant form under reduced motion, and the phone's control set.
// The interaction contract itself (drag, wheel, clamps, buttons) lives in
// cameraControls.spec.ts.

const first = (await loadCollection()).first
const facts = await readProductCameraFacts(first.slug)

const zoomIn = (page: Page): Locator => page.getByRole('button', { name: siteCopy.zoomInLabel })
const zoomOut = (page: Page): Locator => page.getByRole('button', { name: siteCopy.zoomOutLabel })
const reset = (page: Page): Locator => page.getByRole('button', { name: siteCopy.resetLabel })

async function readyStage(page: Page, backendPath: string): Promise<void> {
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)
}

test('Reset eases back to the home view and the readouts show home', async ({
  page,
  backendPath,
}) => {
  // The eased moves' damping tails run long on the software-rendered
  // backends under the full matrix, so this test takes the slow budget.
  test.slow()
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const expected = homeExpectation(facts, first, await stageAspectOfCanvas(page))
  const homeAzimuth = (facts.home.azimuthDegrees * Math.PI) / 180

  await dragOnCanvas(page, center, { x: center.x + 240, y: center.y - 160 })
  for (let wheel = 0; wheel < 6; wheel += 1) {
    await page.mouse.wheel(0, 240)
  }
  await settledFrames(page)
  const moved = await readCamera(page)
  if (moved === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(
    Math.abs(moved.azimuth - homeAzimuth),
    'the drag must have moved the camera away from home first',
  ).toBeGreaterThan(0.1)

  await reset(page).click()
  await settledFrames(page)

  const home = await readCamera(page)
  if (home === null) {
    throw new Error('the live stage camera must be readable')
  }
  // Within the controls' rest threshold, the camera is home again: the
  // angles and the distance of the authored view.
  expect(home.azimuth).toBeCloseTo(homeAzimuth, 2)
  expect(home.polar).toBeCloseTo((facts.home.polarDegrees * Math.PI) / 180, 2)
  expect(Math.abs(home.distance - expected.distance)).toBeLessThanOrEqual(REST_THRESHOLD)
  await expect(page.locator('[data-corner="top-right"]')).toHaveText('325 / 360')
  await expect(page.locator('[data-corner="bottom-right"]')).toContainText(
    zoomReadoutText(expected.zoomPercent),
  )
})

test('under reduced motion, Reset lands home on the next rendered frame', async ({
  page,
  backendPath,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const expected = homeExpectation(facts, first, await stageAspectOfCanvas(page))

  await dragOnCanvas(page, center, { x: center.x + 240, y: center.y - 160 })
  await settledFrames(page)
  const framesBefore = await settledFrames(page)

  await reset(page).click()
  await page.waitForFunction(
    (previous: number) => (window.__viewer?.renderedFrames ?? -1) > previous,
    framesBefore,
    { polling: 'raf' },
  )

  // The first rendered frame after the click already shows the home view:
  // reduced motion moves the camera instantly, with no eased approach.
  const landed = await readCamera(page)
  if (landed === null) {
    throw new Error('the live stage camera must be readable')
  }
  expect(landed.azimuth).toBeCloseTo((facts.home.azimuthDegrees * Math.PI) / 180, 6)
  expect(landed.polar).toBeCloseTo((facts.home.polarDegrees * Math.PI) / 180, 6)
  expect(landed.distance).toBeCloseTo(expected.distance, 6)
  expect(landed.position.x).toBeCloseTo(expected.position.x, 6)
  expect(landed.position.y).toBeCloseTo(expected.position.y, 6)
  expect(landed.position.z).toBeCloseTo(expected.position.z, 6)
})

test('under 640px the zoom cluster drops and Reset stays', async ({ page, backendPath }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await readyStage(page, backendPath)

  // The pill keeps Reset; the zoom buttons and the percentage readout are
  // display-none, not merely off-screen.
  await expect(zoomIn(page)).toBeHidden()
  await expect(zoomOut(page)).toBeHidden()
  await expect(page.getByText('%')).toBeHidden()
  await expect(reset(page)).toBeVisible()
})
