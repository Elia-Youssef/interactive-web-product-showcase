import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { announcementCopy } from '../../src/lib/copy/announcements'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { loadCollection } from './productList'
import { openShownCard, productPathOf, productWithHotspots } from './collectionFacts'
import { focusVisibly } from './measurementFocus'
import { expectPaintedStageFocus } from './paintedStageFocus'
import { REST_THRESHOLD, resolvedDistanceRange } from './stageCamera'
import { readProductCameraFacts } from './productCamera'
import {
  cameraAtRest,
  controlOf,
  expectFocusOn,
  fineStep,
  keyTargetOf,
  liveRegionOf,
  maxPolar,
  minPolar,
  ORBIT_FLOAT_GAP,
  pressOnTarget,
  readyStage,
  recordKeyDefaults,
  rotateStep,
  scrollPositions,
  shownMarkerOf,
  shownZoomPercent,
  tiltStep,
} from './stageKeys'

// The stage turns without a drag or a pinch: a focusable stage target takes
// the arrows (Shift for the fine step), plus and minus, and Home, and the
// stage controls carry rotate and tilt buttons. A step lands exactly one
// configured step from where the camera rests, with the sign of a drag;
// the tilt and the zoom stop exactly at their limits and say so through the
// shell's live region; the keys the stage does not take keep their meaning.

const collection = await loadCollection()
const subject = productWithHotspots(collection)
const path = (backendPath: string) => productPathOf(backendPath, subject)

test('Tab reaches the stage target and the rotate buttons, ring drawn', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, path(backendPath))
  await focusVisibly(page, keyTargetOf(page))
  await expectPaintedStageFocus(page, keyTargetOf(page))
  await focusVisibly(page, controlOf(page, siteCopy.rotateLeftLabel))
  await focusVisibly(page, controlOf(page, siteCopy.rotateRightLabel))
  await focusVisibly(page, controlOf(page, siteCopy.tiltUpLabel))
})

test('the arrows turn by exactly one step, right with the sign of a right drag', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, path(backendPath))
  const start = await cameraAtRest(page)

  await pressOnTarget(page, ['ArrowRight'])
  const right = await cameraAtRest(page)
  expect(Math.abs(right.azimuth - (start.azimuth - rotateStep))).toBeLessThanOrEqual(
    ORBIT_FLOAT_GAP,
  )
  expect(right.polar).toBeCloseTo(start.polar, 9)

  await pressOnTarget(page, ['ArrowLeft', 'ArrowLeft'])
  const left = await cameraAtRest(page)
  expect(Math.abs(left.azimuth - (start.azimuth + rotateStep))).toBeLessThanOrEqual(ORBIT_FLOAT_GAP)

  await pressOnTarget(page, ['Shift+ArrowRight'])
  const fine = await cameraAtRest(page)
  expect(Math.abs(fine.azimuth - (left.azimuth - fineStep))).toBeLessThanOrEqual(ORBIT_FLOAT_GAP)

  await pressOnTarget(page, ['ArrowUp'])
  const up = await cameraAtRest(page)
  expect(Math.abs(up.polar - Math.min(fine.polar + tiltStep, maxPolar))).toBeLessThanOrEqual(
    ORBIT_FLOAT_GAP,
  )
})

test('the tilt keys stop exactly at both polar limits and name them', async ({
  page,
  backendPath,
}) => {
  test.slow()
  await readyStage(page, path(backendPath))
  const steps = Math.ceil(180 / stageCameraConfig.tiltStepDegrees)

  await pressOnTarget(page, Array<string>(steps).fill('ArrowUp'))
  expect((await cameraAtRest(page)).polar).toBeCloseTo(maxPolar, 9)
  await expect(controlOf(page, siteCopy.tiltUpLabel)).toBeDisabled()
  await expect(liveRegionOf(page)).toHaveText(announcementCopy.tiltLimit.bottom)

  await pressOnTarget(page, Array<string>(steps).fill('ArrowDown'))
  expect((await cameraAtRest(page)).polar).toBeCloseTo(minPolar, 9)
  await expect(controlOf(page, siteCopy.tiltDownLabel)).toBeDisabled()
  await expect(liveRegionOf(page)).toHaveText(announcementCopy.tiltLimit.top)
})

test('plus and minus step the zoom and stop at 100 and 0', async ({ page, backendPath }) => {
  test.slow()
  await readyStage(page, path(backendPath))
  const step = stageCameraConfig.zoomStepPercent
  const steps = Math.ceil(100 / step) + 1
  // The readout rounds the live distance, which rests within the controls'
  // rest threshold of the move's end: the shown percent sits that many
  // points from the exact one, plus the rounding (cameraControls.spec.ts
  // derives the same bound).
  const facts = await readProductCameraFacts(subject.slug)
  const range = resolvedDistanceRange(subject, facts.home.distance)
  const restPoints = Math.ceil((REST_THRESHOLD / (range.max - range.min)) * 100)
  const homePercent = ((range.max - facts.home.distance) / (range.max - range.min)) * 100
  const expectShown = async (percent: number) => {
    await cameraAtRest(page)
    expect(Math.abs((await shownZoomPercent(page)) - percent)).toBeLessThanOrEqual(restPoints)
  }

  await pressOnTarget(page, ['+'])
  await expectShown(homePercent + step)

  await pressOnTarget(page, Array<string>(steps).fill('='))
  await expectShown(100)
  await expect(controlOf(page, siteCopy.zoomInLabel)).toBeDisabled()
  await expect(liveRegionOf(page)).toHaveText(announcementCopy.zoomLimit.closest)

  await pressOnTarget(page, Array<string>(steps).fill('-'))
  await expectShown(0)
  await expect(controlOf(page, siteCopy.zoomOutLabel)).toBeDisabled()
  await expect(liveRegionOf(page)).toHaveText(announcementCopy.zoomLimit.farthest)
})

test('Home returns to the home view, closes the open card and says so', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, path(backendPath))
  const home = await cameraAtRest(page)
  await openShownCard(page, subject)
  await expect(page.getByTestId('hotspot-card')).toHaveCount(1)

  await pressOnTarget(page, ['ArrowRight', 'ArrowDown', 'Home'])
  const after = await cameraAtRest(page)
  expect(after.azimuth).toBeCloseTo(home.azimuth, 6)
  expect(after.polar).toBeCloseTo(home.polar, 6)
  await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
  await expect(liveRegionOf(page)).toHaveText(announcementCopy.homeView)
})

test('modified keys keep their browser meaning; Escape still closes a card', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, path(backendPath))
  const before = await cameraAtRest(page)
  const keyDefaults = await recordKeyDefaults(page)

  await pressOnTarget(page, ['Control+Equal', 'Control+Minus', 'Alt+ArrowLeft', 'Meta+ArrowRight'])
  expect(await keyDefaults(), "no modified key is the stage key target's").toBe('kkkk')
  const after = await cameraAtRest(page)
  expect(after.azimuth).toBe(before.azimuth)
  expect(after.distance).toBe(before.distance)

  await openShownCard(page, subject)
  await pressOnTarget(page, ['Escape'])
  await expect(page.getByTestId('hotspot-card')).toHaveCount(0)
})

test('an arrow on a focused marker neither turns the stage nor moves focus', async ({
  page,
  backendPath,
}) => {
  await readyStage(page, path(backendPath))
  const before = await cameraAtRest(page)
  const marker = await shownMarkerOf(page, subject)
  await marker.focus()

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  const after = await cameraAtRest(page)
  expect(after.azimuth).toBe(before.azimuth)
  expect(after.polar).toBe(before.polar)
  await expectFocusOn(marker, 'focus stays on the marker')
})

test('the arrows on the target scroll neither the panel nor the page', async ({
  page,
  backendPath,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await readyStage(page, path(backendPath))
  await keyTargetOf(page).focus()
  const before = await scrollPositions(page)

  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.press(key)
  }
  await cameraAtRest(page)
  expect(await scrollPositions(page)).toBe(before)
})

test('under reduced motion a key lands the camera on the next rendered frame', async ({
  page,
  backendPath,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await readyStage(page, path(backendPath))
  const start = await cameraAtRest(page)
  const previous = await page.evaluate(() => window.__viewer?.completion?.requestedSequence ?? -1)

  await pressOnTarget(page, ['ArrowRight'])
  await page.waitForFunction(
    (previous: number) =>
      (window.__viewer?.completion?.firstRequestFrame?.sequence ?? -1) > previous,
    previous,
    { polling: 'raf' },
  )
  const landed = await page.evaluate(() => window.__viewer?.completion?.firstRequestFrame)
  expect(landed?.azimuth).toBeCloseTo(start.azimuth - rotateStep, 9)
})

test('Tab leaves the target in both directions', async ({ page, backendPath }) => {
  await readyStage(page, path(backendPath))
  const target = keyTargetOf(page)

  await target.focus()
  await page.keyboard.press('Tab')
  expect(await target.evaluate((element) => element === document.activeElement)).toBe(false)

  await target.focus()
  await page.keyboard.press('Shift+Tab')
  expect(await target.evaluate((element) => element === document.activeElement)).toBe(false)
})

test('each turn button moves the camera by its key step, on a phone too', async ({
  page,
  backendPath,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await readyStage(page, path(backendPath))
  const start = await cameraAtRest(page)

  await controlOf(page, siteCopy.rotateRightLabel).click()
  const right = await cameraAtRest(page)
  expect(Math.abs(right.azimuth - (start.azimuth - rotateStep))).toBeLessThanOrEqual(
    ORBIT_FLOAT_GAP,
  )

  await controlOf(page, siteCopy.rotateLeftLabel).click()
  const left = await cameraAtRest(page)
  expect(Math.abs(left.azimuth - start.azimuth)).toBeLessThanOrEqual(ORBIT_FLOAT_GAP)

  await controlOf(page, siteCopy.tiltDownLabel).click()
  const down = await cameraAtRest(page)
  expect(Math.abs(down.polar - Math.max(start.polar - tiltStep, minPolar))).toBeLessThanOrEqual(
    ORBIT_FLOAT_GAP,
  )
  await expect(controlOf(page, siteCopy.zoomInLabel)).toBeVisible()
  await expect(controlOf(page, siteCopy.zoomOutLabel)).toBeVisible()
})
