import { expect, test } from './fixtures'
import { waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { testBodyBudgetMs } from './budgets'
import {
  countRecordsAfter,
  installCameraFrameRecorder,
  stopCameraFrameRecording,
} from './cameraFrameRecorder'
import {
  dispatchedMoves,
  installPerFrameDragDriver,
  recordedDragMoves,
  stopPerFrameDragDriver,
} from './cameraPerFrameDrag'

// Short and longer sequences expose both a zero-distance first move and
// an unbounded driver. Later presented frames must not dispatch more input
// or release the pointer before the recording has acknowledged every move.
const MOVE_LIMITS = [1, 7]
const DX_PER_FRAME = 20
const POINTER_ID = 7

for (const moveLimit of MOVE_LIMITS) {
  test(`a finite drag records all ${moveLimit} steps before pointer release`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(backendPath)
    await waitForProductReady(page)
    await settledFrames(page)
    const canvas = page.locator('[data-slot="stage"] canvas')
    const box = await canvas.boundingBox()
    if (box === null) {
      throw new Error('the stage canvas must have a bounding box')
    }
    const azimuthAtRest = await page.evaluate(() => window.__viewer?.camera?.azimuth)
    if (azimuthAtRest === undefined) {
      throw new Error('the stage camera must be readable')
    }
    await canvas.evaluate((element) => {
      element.setAttribute('data-pointer-releases', '0')
      element.addEventListener('pointerup', () => {
        const count = Number(element.getAttribute('data-pointer-releases'))
        element.setAttribute('data-pointer-releases', String(count + 1))
      })
    })
    await installCameraFrameRecorder(page)
    await installPerFrameDragDriver(page, {
      pointerId: POINTER_ID,
      startX: box.x + box.width / 2 - (moveLimit * DX_PER_FRAME) / 2,
      startY: box.y + box.height / 2,
      dxPerFrame: DX_PER_FRAME,
      moveLimit,
    })
    await expect.poll(() => recordedDragMoves(page), { timeout: testBodyBudgetMs }).toBe(moveLimit)
    const lastDispatchFrame = await page.evaluate(() => {
      const frame = window.__perFrameDrag?.dispatchedAtFrames.at(-1)
      if (frame === undefined) {
        throw new Error('the finite drag must dispatch its final move')
      }
      return frame
    })
    await expect
      .poll(() => countRecordsAfter(page, lastDispatchFrame), { timeout: testBodyBudgetMs })
      .toBeGreaterThanOrEqual(2)
    expect(await dispatchedMoves(page), 'later frames must not dispatch additional moves').toBe(
      moveLimit,
    )
    await expect(canvas).toHaveAttribute('data-pointer-releases', '0')
    const recording = await stopCameraFrameRecording(page)
    const driver = await stopPerFrameDragDriver(page)
    expect(driver.moveCount).toBe(moveLimit)
    expect(driver.dispatchTimesMs).toHaveLength(moveLimit + 2)
    for (const frame of driver.dispatchedAtFrames) {
      expect(recording.records.some((record) => record.frames > frame)).toBe(true)
    }
    await expect(canvas).toHaveAttribute('data-pointer-releases', '1')
    await settledFrames(page)
    const azimuth = await page.evaluate(() => window.__viewer?.camera?.azimuth)
    const expectedAzimuth = azimuthAtRest - (2 * Math.PI * moveLimit * DX_PER_FRAME) / box.height
    expect(azimuth).toBeCloseTo(expectedAzimuth, 2)
  })
}
