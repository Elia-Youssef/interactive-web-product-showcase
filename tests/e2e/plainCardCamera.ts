import { expect, type Page } from '@playwright/test'
import { harnessCanvasDrivePoint, requireCamera } from './hotspotViews'
import type { CameraRead } from './stageCamera'
import { completedPresentation } from './presentationCompletion'

// A plain card owes no camera move. Both layouts compare the camera itself
// after its input frame debt settles, since a stationary canvas press can
// request a frame without moving anything.
const wheelDeltaYPx = 120

export async function readPlainCloseCamera(page: Page): Promise<CameraRead> {
  await completedPresentation(page)
  return requireCamera(page)
}

// Move away from the initial home pose before opening the plain card, so
// an incorrect reset on close cannot pass by landing where it started.
// Choose the direction with more room, including homes at a distance limit.
export async function preparePlainCloseCamera(page: Page): Promise<void> {
  const before = await readPlainCloseCamera(page)
  const deltaYPx =
    before.maxDistance - before.distance >= before.distance - before.minDistance
      ? wheelDeltaYPx
      : -wheelDeltaYPx
  const point = await harnessCanvasDrivePoint(page)
  await page.mouse.move(point.x, point.y)
  await page.mouse.wheel(0, deltaYPx)
  const after = await readPlainCloseCamera(page)
  expect(after.distance, 'the plain-card setup must move away from home').not.toBe(before.distance)
}

export async function expectPlainCloseCameraUnchanged(
  page: Page,
  before: CameraRead,
  way: string,
): Promise<void> {
  expect(await readPlainCloseCamera(page), `${way} must leave the camera unchanged`).toEqual(before)
}
