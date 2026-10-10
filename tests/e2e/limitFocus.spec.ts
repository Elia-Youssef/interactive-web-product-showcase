import { expect, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'
import { announcementCopy } from '../../src/lib/copy/announcements'
import { siteCopy } from '../../src/lib/copy/site'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { focusVisibly } from './measurementFocus'
import { REST_THRESHOLD } from './stageCamera'
import type { CameraRead } from './stageCamera'
import {
  cameraAtRest,
  controlOf,
  expectFocusOn,
  expectUnavailable,
  liveRegionOf,
  maxPolar,
  minPolar,
  ORBIT_FLOAT_GAP,
  readyStage,
  tiltStep,
} from './stageKeys'
import { renderedFramesOf, settledFrames } from './stageSettle'

// A stage control that reaches its limit while it holds the keyboard focus
// keeps both: the announced wait drops no focus on the body, a further
// Enter does nothing (no frame, no move), the opposite control works from
// the keyboard, and the waiting control answers again, with the focus
// never leaving the controls. The presses reach each limit from anywhere
// inside its range: the whole span in steps, plus one, so the last press
// lands on the limit or is dropped by the control that already waits there.

const product = (await loadCollection()).first
const path = (backendPath: string) => productPathOf(backendPath, product)

// One flow of the class: the control, its limit, the words the limit
// announces, and the one step the opposite control moves the camera off it.
type LimitFlow = {
  readonly name: string
  readonly control: (page: Page) => Locator
  readonly opposite: (page: Page) => Locator
  // The key presses that reach the limit from anywhere in the range.
  readonly presses: number
  readonly limitWords: string
  // The camera rest the limit holds.
  readonly atLimit: (page: Page) => Promise<void>
  // The one step the opposite press moves, read against the limit rest.
  readonly oneStepOff: (atLimit: CameraRead, page: Page) => Promise<void>
}

const zoomPresses = Math.ceil(100 / stageCameraConfig.zoomStepPercent) + 1
const tiltPresses = Math.ceil(180 / stageCameraConfig.tiltStepDegrees)

// The zoom step the readout's percentage points map to at this distance
// range, in world units.
const zoomStepOf = (read: CameraRead): number =>
  (read.maxDistance - read.minDistance) * (stageCameraConfig.zoomStepPercent / 100)

// The camera rests at the distance limit its control walked to.
async function atDistanceLimit(page: Page, end: 'closest' | 'farthest'): Promise<void> {
  const camera = await cameraAtRest(page)
  const limit = end === 'closest' ? camera.minDistance : camera.maxDistance
  expect(
    Math.abs(camera.distance - limit),
    `the camera must rest at its ${end} distance`,
  ).toBeLessThanOrEqual(REST_THRESHOLD)
}

const flows: readonly LimitFlow[] = [
  {
    name: 'zoom in',
    control: (page) => controlOf(page, siteCopy.zoomInLabel),
    opposite: (page) => controlOf(page, siteCopy.zoomOutLabel),
    presses: zoomPresses,
    limitWords: announcementCopy.zoomLimit.closest,
    atLimit: (page) => atDistanceLimit(page, 'closest'),
    oneStepOff: async (atLimit, page) => {
      const after = await cameraAtRest(page)
      expect(
        Math.abs(after.distance - (atLimit.distance + zoomStepOf(atLimit))),
        'one press out moves the camera one zoom step off the closest limit',
      ).toBeLessThanOrEqual(REST_THRESHOLD)
    },
  },
  {
    name: 'zoom out',
    control: (page) => controlOf(page, siteCopy.zoomOutLabel),
    opposite: (page) => controlOf(page, siteCopy.zoomInLabel),
    presses: zoomPresses,
    limitWords: announcementCopy.zoomLimit.farthest,
    atLimit: (page) => atDistanceLimit(page, 'farthest'),
    oneStepOff: async (atLimit, page) => {
      const after = await cameraAtRest(page)
      expect(
        Math.abs(after.distance - (atLimit.distance - zoomStepOf(atLimit))),
        'one press in moves the camera one zoom step off the farthest limit',
      ).toBeLessThanOrEqual(REST_THRESHOLD)
    },
  },
  {
    name: 'tilt up',
    control: (page) => controlOf(page, siteCopy.tiltUpLabel),
    opposite: (page) => controlOf(page, siteCopy.tiltDownLabel),
    presses: tiltPresses,
    limitWords: announcementCopy.tiltLimit.bottom,
    atLimit: async (page) => {
      expect((await cameraAtRest(page)).polar).toBeCloseTo(maxPolar, 9)
    },
    oneStepOff: async (atLimit, page) => {
      expect(
        Math.abs((await cameraAtRest(page)).polar - (atLimit.polar - tiltStep)),
        'one press down tilts the camera one step off the bottom view limit',
      ).toBeLessThanOrEqual(ORBIT_FLOAT_GAP)
    },
  },
  {
    name: 'tilt down',
    control: (page) => controlOf(page, siteCopy.tiltDownLabel),
    opposite: (page) => controlOf(page, siteCopy.tiltUpLabel),
    presses: tiltPresses,
    limitWords: announcementCopy.tiltLimit.top,
    atLimit: async (page) => {
      expect((await cameraAtRest(page)).polar).toBeCloseTo(minPolar, 9)
    },
    oneStepOff: async (atLimit, page) => {
      expect(
        Math.abs((await cameraAtRest(page)).polar - (atLimit.polar + tiltStep)),
        'one press up tilts the camera one step off the top view limit',
      ).toBeLessThanOrEqual(ORBIT_FLOAT_GAP)
    },
  },
]

// The class flow for one control: focus it by keyboard, press Enter until
// its limit waits, and hold the focus through the wait and the dropped
// press; the opposite control then works from the keyboard and the waiting
// one answers again, the focus never landing on the body.
async function pressToLimitAndBack(page: Page, flow: LimitFlow): Promise<void> {
  const control = flow.control(page)
  const opposite = flow.opposite(page)

  await focusVisibly(page, control)
  for (let press = 0; press < flow.presses; press += 1) {
    await page.keyboard.press('Enter')
  }

  // The limit waits announced, focus held: the control stays in the tab
  // order, the camera rests at the limit, and the live region names it.
  await expectUnavailable(control)
  await expectFocusOn(control, `${flow.name}: the limit keeps the focus on the control`)
  await flow.atLimit(page)
  await expect(liveRegionOf(page)).toHaveText(flow.limitWords)

  // A further Enter is dropped: no frame renders, the camera read holds,
  // and the focus stays.
  const frames = await renderedFramesOf(page)
  const atLimit = await cameraAtRest(page)
  await page.keyboard.press('Enter')
  expect(await settledFrames(page)).toBe(frames)
  await expectFocusOn(control, `${flow.name}: a dropped press leaves the focus where it was`)
  const unchanged = await cameraAtRest(page)
  expect(unchanged.azimuth).toBe(atLimit.azimuth)
  expect(unchanged.polar).toBe(atLimit.polar)
  expect(unchanged.distance).toBe(atLimit.distance)

  // The opposite control works from the keyboard, and the waiting control
  // answers again.
  await focusVisibly(page, opposite)
  await page.keyboard.press('Enter')
  await expectFocusOn(opposite, `${flow.name}: the opposite control holds its focus`)
  await flow.oneStepOff(atLimit, page)
  await expect(control).not.toHaveAttribute('aria-disabled')
}

for (const flow of flows) {
  test(`the ${flow.name} control keeps the keyboard focus at its limit and answers again`, async ({
    page,
    backendPath,
  }) => {
    // The eased moves' damping tails run long on the software-rendered
    // backends under the full matrix, so this test takes the slow budget.
    test.slow()
    await readyStage(page, path(backendPath))
    await pressToLimitAndBack(page, flow)
  })
}
