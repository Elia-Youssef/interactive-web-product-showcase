import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { testBodyBudgetMs } from './budgets'
import { installCameraFrameRecorder, stopCameraFrameRecording } from './cameraFrameRecorder'
import {
  recordedDragMoves,
  installPerFrameDragDriver,
  stopPerFrameDragDriver,
} from './cameraPerFrameDrag'
import { easedAngleStep } from './stageCamera'

// The class of the defect this spec pins: an input step delivered for
// every presented frame, the way a real continuous drag aligns to the
// display. The move-start events camera-controls fires on every applied
// step must not re-anchor the running clock: each in-motion frame's step
// is the frame gap, and the trail follows frame-gap stepping. Nothing is
// assumed about which page callback ran where: every move records the
// stage's frame count at its dispatch, so the replay reads from the
// recording which presented frame applied it, and steps the restated
// camera-controls recurrence over the recorded frame times.

const MOVES = 90
const DX_PER_FRAME = 2
const POINTER_ID = 7

async function readAzimuth(page: Page): Promise<number | null> {
  return page.evaluate(() => window.__viewer?.camera?.azimuth ?? null)
}

test('a drag with a step per presented frame trails as frame-gap stepping predicts', async ({
  page,
  backendPath,
}) => {
  test.slow()
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledFrames(page)

  const canvas = page.locator('[data-slot="stage"] canvas')
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('the stage canvas must have a bounding box')
  }
  const startX = box.x + box.width / 2 - (MOVES * DX_PER_FRAME) / 2
  const startY = box.y + box.height / 2

  const azimuthAtRest = await readAzimuth(page)
  if (azimuthAtRest === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }

  await installCameraFrameRecorder(page)
  await installPerFrameDragDriver(page, {
    pointerId: POINTER_ID,
    startX,
    startY,
    dxPerFrame: DX_PER_FRAME,
    moveLimit: MOVES,
  })
  await expect
    .poll(() => recordedDragMoves(page), {
      message: 'the recorder must acknowledge every dispatched step while dragging',
      timeout: testBodyBudgetMs,
    })
    .toBe(MOVES)
  const recording = await stopCameraFrameRecording(page)
  const driver = await stopPerFrameDragDriver(page)

  // The pairing: move k applies at the first presented frame after its
  // dispatch. The recorder labels its records with the stage's own frame
  // count but can skip one under load, so the applying record is the first
  // record past the count, not the count plus one.
  const applying = new Map<number, number[]>()
  let replayedMoves = 0
  for (let k = 0; k < driver.moveCount; k += 1) {
    const at = driver.dispatchedAtFrames[k]
    if (at === undefined) {
      throw new Error(`the driver must record the frame count of move ${k + 1}'s dispatch`)
    }
    const index = recording.records.findIndex((record) => record.frames > at)
    if (index === -1) {
      throw new Error(`the recorder must acknowledge move ${k + 1} before pointer release`)
    }
    const queue = applying.get(index) ?? []
    queue.push(k)
    applying.set(index, queue)
    replayedMoves += 1
  }

  // The restated rotation mapping of the applied steps: one pointer step
  // of dx pixels turns the end azimuth by 2 pi dx over the canvas height
  // (camera-controls dist/camera-controls.module.js, _rotateInternal,
  // azimuthRotateSpeed 1). The drag eases on the dragging smooth time,
  // which the controls pick while the pointer controls them.
  const thetaPerMove = (2 * Math.PI * -DX_PER_FRAME) / box.height
  const smoothTime = stageCameraConfig.draggingSmoothTimeSeconds
  const totalTravel = driver.moveCount * Math.abs(thetaPerMove)

  // The replay over the recorded frames, in order. The first moving frame
  // ends an idle at a move dispatched in its own rendering phase, so its
  // step is the sub-millisecond offset from that dispatch to the frame's
  // update, taken as zero within the bound; every later frame is in motion
  // and steps by the gap between its record and the previous one.
  let angle = azimuthAtRest
  let velocity = 0
  let end = azimuthAtRest
  let firstMoving = true
  let previousAtMs: number | null = null
  const recordIndexes = [...applying.keys()].sort((a, b) => a - b)
  for (const index of recordIndexes) {
    const record = recording.records[index]
    if (record === undefined) {
      throw new Error(`the recording must hold the frame that applied the moves (record ${index})`)
    }
    const moves = applying.get(index) ?? []
    const dtSeconds = firstMoving
      ? 0
      : previousAtMs === null
        ? 0
        : (record.atMs - previousAtMs) / 1000
    firstMoving = false
    previousAtMs = record.atMs
    for (let move = 0; move < moves.length; move += 1) {
      end += thetaPerMove
    }
    const stepped = easedAngleStep({
      currentRadians: angle,
      endRadians: end,
      velocityRadiansPerSecond: velocity,
      smoothTimeSeconds: smoothTime,
      dtSeconds,
    })
    angle = stepped.angleRadians
    velocity = stepped.velocityRadiansPerSecond

    // The bound and its cause: the record times stand in for the update
    // times from inside the same rendering phases, and on a software
    // rasterizer their per-frame jitter of one to three milliseconds
    // perturbs the trail by up to about two percent of the whole travel, a
    // perturbation the recurrence then contracts. The bound is five
    // percent of the whole travel; the re-anchored rule this spec
    // replaces stepped every frame by its sub-millisecond lead instead of
    // the gap, losing about eighty percent of the travel by the pointer
    // stop, sixteen times outside it.
    const travel = Math.abs(end - azimuthAtRest)
    expect(
      Math.abs(record.azimuth - angle),
      `the dragged azimuth at record ${index} must match the frame-gap replay ` +
        `(replayed ${angle.toFixed(5)}, recorded ${record.azimuth.toFixed(5)}, ` +
        `travel ${travel.toFixed(5)})`,
    ).toBeLessThanOrEqual(0.05 * totalTravel + 1e-9)
  }

  // The drag moved the camera by its whole travel, eased out to the end.
  expect(replayedMoves, 'the replay must cover the moves the recorder held frames for').toBe(MOVES)
  const travelEnd = Math.abs(replayedMoves * thetaPerMove)
  expect(travelEnd, 'the drag must have traveled').toBeGreaterThan(0.1)
  await settledFrames(page)
  const settledAzimuth = await readAzimuth(page)
  if (settledAzimuth === null) {
    throw new Error('the live stage camera must stay readable')
  }
  expect(Math.abs(settledAzimuth - (azimuthAtRest - travelEnd))).toBeLessThanOrEqual(0.02)
})
