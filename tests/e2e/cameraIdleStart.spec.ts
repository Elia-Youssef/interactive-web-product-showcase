import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { stageCameraConfig } from '../../src/viewer/camera/config'
import { loadCollection } from './productList'
import { readProductCameraFacts } from './productCamera'
import { waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { testBodyBudgetMs } from './budgets'
import {
  homeExpectation,
  ONE_STEP_FLOAT_GAP,
  oneStepFractionFromRest,
  readCamera,
  REST_THRESHOLD,
  stageAspectOfCanvas,
} from './stageCamera'
import {
  countRecordsAfter,
  installCameraFrameRecorder,
  stopCameraFrameRecorder,
} from './cameraFrameRecorder'

// The defect this spec pins: the stage renders on demand, so it idles
// between moves, and an eased move that starts after an idle used to step
// over the whole idle on its first presented frame, covering most of its
// distance at once. The move's clock now starts when the move starts, so
// the first presented frame carries only what one frame gap from the move's
// start eases. The recording reads every presented frame page-side, so no
// protocol sample can stand in for the frame the visitor sees.

const first = (await loadCollection()).first
const facts = await readProductCameraFacts(first.slug)

// The idle the experiment conditions the stage on: inside the 0.2 to 2 s
// range the jump was measured over, and long enough that no load frame of
// the zoom step before it can fall into the move's first gap.
const IDLE_MS = 1000

async function readyStage(page: Page, backendPath: string) {
  await page.goto(backendPath)
  await waitForProductReady(page)
  await settledFrames(page)
}

function requireCamera(distance: number | null): number {
  if (distance === null) {
    throw new Error('the live stage camera must be readable once a view is presented')
  }
  return distance
}

test('a move that starts after an idle eases from its start on the first presented frame', async ({
  page,
  backendPath,
}) => {
  // The idle, the eased move and the landing run long on the
  // software-rendered backends, so this test takes the slow budget.
  test.slow()
  await readyStage(page, backendPath)

  // A zoom step first, so the move under test has a distance to cover: it
  // eases back to the home distance from the stepped distance.
  await page.getByRole('button', { name: siteCopy.zoomInLabel }).click()
  const framesAtRest = await settledFrames(page)
  const zoomedDistance = requireCamera((await readCamera(page))?.distance ?? null)
  const stageAspect = await stageAspectOfCanvas(page)
  const expected = homeExpectation(facts, first, stageAspect)
  expect(
    expected.distance - zoomedDistance,
    `the zoom step must have moved the camera away from the home distance first ` +
      `(home ${expected.distance}, zoomed ${zoomedDistance}, aspect ${stageAspect})`,
  ).toBeGreaterThan(REST_THRESHOLD)

  // The stage idles a full second with no frame at all.
  await page.waitForTimeout(IDLE_MS)
  expect(await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)).toBe(framesAtRest)

  await installCameraFrameRecorder(page)
  const framesBeforeClick = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
  await page.getByRole('button', { name: siteCopy.resetLabel }).click()
  await expect
    .poll(() => countRecordsAfter(page, framesBeforeClick), {
      message: 'the move must present frames after the click',
      timeout: testBodyBudgetMs,
    })
    .toBeGreaterThanOrEqual(2)
  const recording = await stopCameraFrameRecorder(page)
  const clickedAtMs = recording.clickedAtMs
  if (clickedAtMs === null) {
    throw new Error('the recorder must timestamp the click that starts the move')
  }

  // The bound, on every presented frame of the move's first window: the
  // driver steps each frame by the time from the move's start event to the
  // frame's own tick, which is at most the recorded age of that frame from
  // the click, so the one-step fraction at the frame's age bounds its
  // cumulative fraction of the move. The recurrence stepped over the
  // window's frames exceeds the one-step formula by at most 1.6e-4 at
  // these ages (the discretization difference of the same recurrence), and
  // the record's timestamp can lag its update by a millisecond or two, so
  // the bound adds one thousandth absolute. The float gap carries the
  // rounding of the two arithmetic paths. The stepped-over idle this spec
  // replaces carried 0.60 to 0.95 of the move on its first carrying frame,
  // an order of magnitude over the bound. An engine may present a first
  // frame that moved nothing; the move must present movement inside the
  // window, and the landing check below proves it completes.
  const approachWindowMs = 300
  const recordsAfterClick = recording.records.filter(
    (record) => record.frames > framesBeforeClick && record.atMs - clickedAtMs <= approachWindowMs,
  )
  expect(
    recordsAfterClick.length,
    'the move must present frames inside the approach window',
  ).toBeGreaterThanOrEqual(1)
  let moved = false
  for (const record of recordsAfterClick) {
    const ageSeconds = (record.atMs - clickedAtMs) / 1000
    const bound = oneStepFractionFromRest(stageCameraConfig.transitionSmoothTimeSeconds, ageSeconds)
    const fraction = (record.distance - zoomedDistance) / (expected.distance - zoomedDistance)
    moved = moved || fraction > 0
    expect(
      fraction,
      `the presented frame ${Math.round(ageSeconds * 1000)} ms after the click carried ` +
        `${fraction.toFixed(4)} of the move, over the one-step bound at its age ` +
        `${bound.toFixed(4)}`,
    ).toBeLessThanOrEqual(bound + 0.001 + ONE_STEP_FLOAT_GAP)
  }
  expect(moved, 'the move must have started easing inside the window').toBe(true)

  // The move still eases to its end: the recording spans frames, and the
  // stage lands at the home distance at rest.
  await settledFrames(page)
  const landed = requireCamera((await readCamera(page))?.distance ?? null)
  expect(Math.abs(landed - expected.distance)).toBeLessThanOrEqual(REST_THRESHOLD)
})
