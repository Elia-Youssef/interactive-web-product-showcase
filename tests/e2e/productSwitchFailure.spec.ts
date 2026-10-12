import { expect, test } from './fixtures'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { controlFrameSupply, holdFrames, releaseFrames } from './frameSupply'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import { expectProductAlert, pollProductChannel } from './productFailureChannel'
import { loadCollection } from './productList'
import { harnessPath } from './productSpecs'
import {
  modelUrlOf,
  recordPhases,
  recordedSnapshots,
  recordedSwaps,
  switchPhase,
  waitForPhase,
  waitForRest,
} from './productSwitchFacts'
import { renderedFramesOf, settledStage } from './stageSettle'

const collection = await loadCollection()
const start = collection.first
const next = neighborsOf(collection, start).next

test('a failed model reveals only after the stage records the empty swap twice', async ({
  page,
  backendPath,
  expectedBrowserName,
  consoleGate,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await controlFrameSupply(page)
  await page.route(`**${modelUrlOf(next)}`, (route) => route.abort())
  if (expectedBrowserName === 'chromium') {
    consoleGate.expectError(/Failed to load resource|net::/, { times: 'one-or-more' })
  }
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await settledStage(page)
  const before = await renderedFramesOf(page)
  expect(await page.evaluate(() => window.__viewer?.model?.slug)).toBe(start.slug)
  await recordPhases(page)
  await holdFrames(page)

  // Stability checks themselves need frames, which this proof holds.
  await rowControls(page, collection, start).next.click({ force: true })
  await pollProductChannel(page).toMatchObject({
    product: 'failed',
    productSlug: next.slug,
    failure: { kind: 'load' },
  })
  expect(await renderedFramesOf(page), 'the frame hold was applied').toBe(before)
  for (const snapshot of await recordedSnapshots(page)) {
    if (snapshot.phase === 'revealing') {
      expect(
        snapshot.renderedFrames - before,
        'a reveal cannot precede the recorded frames',
      ).toBeGreaterThanOrEqual(2)
    }
  }
  expect(await switchPhase(page), 'the cover holds while the engine supplies no frames').toBe(
    'covered',
  )
  await releaseFrames(page)
  await waitForPhase(page, 'idle')

  const swaps = await recordedSwaps(page)
  expect(swaps).toHaveLength(1)
  const swap = swaps[0]
  expect(swap).toMatchObject({ to: next.slug, phase: 'covered' })
  if (swap === undefined) {
    throw new Error('the failed product must have swapped under cover')
  }
  expect(swap.renderedFrames).toBeGreaterThanOrEqual(before)
  const reveals = (await recordedSnapshots(page)).filter((entry) => entry.phase === 'revealing')
  expect(reveals).toHaveLength(1)
  for (const reveal of reveals) {
    expect(reveal).toMatchObject({ product: 'failed', productSlug: next.slug, model: null })
    expect(reveal.renderedFrames - swap.renderedFrames).toBeGreaterThanOrEqual(2)
  }
  await expectProductAlert(page, next.slug, `Could not load ${modelUrlOf(next)}`)
})

test('a camera contract failure reports only after the stage records its removal twice', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  const camera = encodeURIComponent(JSON.stringify({ minDistance: 1000 }))
  await page.goto(`${harnessPath(backendPath, start.slug)}&camera=${camera}`)
  await pollProductChannel(page).toMatchObject({
    product: 'failed',
    productSlug: start.slug,
    failure: { kind: 'camera-contract' },
  })
  await expect
    .poll(() => page.evaluate(() => window.__harnessProductReports?.length ?? 0), {
      timeout: productLoadBudgetMs,
    })
    .toBeGreaterThan(0)
  const report = await page.evaluate(() => window.__harnessProductReports?.[0] ?? null)
  expect(report).toMatchObject({ outcome: 'failed', model: null })
  if (report === null || report.failedAtFrame === null) {
    throw new Error('the harness must record both the immediate failure and the settled report')
  }
  expect(report.failedAtFrame).toBeGreaterThanOrEqual(0)
  expect(report.renderedFrames - report.failedAtFrame).toBeGreaterThanOrEqual(2)
  await expectProductAlert(page, start.slug, 'break the stage camera rules')
  await settledStage(page)
  expect(await page.evaluate(() => window.__harnessProductReports?.length)).toBe(1)
})
