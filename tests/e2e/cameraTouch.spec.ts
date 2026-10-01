import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { settledFrames, settledStage } from './stageSettle'
import { canvasCenter, readCamera, REST_THRESHOLD, waitForProductReady } from './stageCamera'
import { touchDrag, touchPinch } from './syntheticTouch'
// The full matrix runs six browsers against one GPU, and the heaviest wait
// in every test here is the busy-matrix ready wait, so each test carries a
// budget above the sum of its waits on the slowest backend.
test.setTimeout(90_000)

// The touch contract, driven with synthesized pointer events (Playwright
// has no multi-touch API): one finger rotates, two fingers pinch to dolly.
// Every test runs on the whole matrix; the synthesized events are the same
// DOM events a real touch produces, on both backends.

async function readyStage(page: Page, backendPath: string): Promise<void> {
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledStage(page)
}

test('one finger rotates the camera and comes to rest', async ({ page, backendPath }) => {
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const before = await readCamera(page)
  if (before === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }

  await touchDrag(page, 0, center, { x: center.x + 200, y: center.y })
  await settledFrames(page)

  const after = await readCamera(page)
  if (after === null) {
    throw new Error('the live stage camera must stay readable')
  }
  // The same sign the mouse drag states: the drag right decreases the
  // azimuth, and one finger never dollies or pans.
  expect(
    after.azimuth,
    `one-finger drag right must decrease the azimuth (before ${before.azimuth}, after ${after.azimuth})`,
  ).toBeLessThan(before.azimuth)
  expect(after.polar).toBeCloseTo(before.polar, 1)
  expect(Math.abs(after.distance - before.distance)).toBeLessThanOrEqual(REST_THRESHOLD)
  expect(after.target.x).toBeCloseTo(before.target.x, 9)
  expect(after.target.y).toBeCloseTo(before.target.y, 9)
  expect(after.target.z).toBeCloseTo(before.target.z, 9)
})

test('two fingers pinch to dolly, outward in and inward out', async ({ page, backendPath }) => {
  await readyStage(page, backendPath)
  const center = await canvasCenter(page)
  const before = await readCamera(page)
  if (before === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }

  // Spread: the camera dollies in, toward the minimum distance.
  await touchPinch(page, center, 120, 90)
  await settledFrames(page)
  const spread = await readCamera(page)
  if (spread === null) {
    throw new Error('the live stage camera must stay readable')
  }
  expect(
    spread.distance,
    `pinching out must decrease the distance (before ${before.distance}, after ${spread.distance})`,
  ).toBeLessThan(before.distance)
  // The pinch never turns the camera.
  expect(spread.azimuth).toBeCloseTo(before.azimuth, 1)
  expect(spread.polar).toBeCloseTo(before.polar, 1)

  // Close the pinch back: the camera dollies out from where the spread
  // left it, toward the maximum.
  await touchPinch(page, center, 210, -120)
  await settledFrames(page)
  const closed = await readCamera(page)
  if (closed === null) {
    throw new Error('the live stage camera must stay readable')
  }
  expect(
    closed.distance,
    `pinching in must increase the distance (spread ${spread.distance}, after ${closed.distance})`,
  ).toBeGreaterThan(spread.distance)
  expect(closed.azimuth).toBeCloseTo(before.azimuth, 1)
  expect(closed.polar).toBeCloseTo(before.polar, 1)
})
