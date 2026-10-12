import { expect, test } from './fixtures'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import { expectProductAlert, frameFaultPath, pollProductChannel } from './productFailureChannel'
import { loadCollection } from './productList'
import { faultProductPresent } from './presentFaultRoute'
import {
  expectSwapsUnderCover,
  recordedPhases,
  recordedSnapshots,
  recordPhases,
  SWITCH_SEQUENCE,
  waitForPhase,
  waitForRest,
} from './productSwitchFacts'
import { renderedFramesOf, settledStage } from './stageSettle'
import { frameFaultMessage } from '../../src/app/product-harness/frameFaultQuery'
import { stageConfig } from '../../src/viewer/config'
import {
  expectProductRetirementReports,
  observeEnvironmentSettleFailures,
} from './environmentSettleReports'

const collection = await loadCollection()
const start = collection.first
const next = neighborsOf(collection, start).next
const recovery = neighborsOf(collection, next).next

test.beforeEach(async ({ page }) => {
  await observeEnvironmentSettleFailures(page)
})

test.afterEach(async ({ page, consoleGate }) => {
  await expectProductRetirementReports(page, consoleGate)
})

test('a retired harness present still reports failed once', async ({ page, backendPath }) => {
  await page.goto(frameFaultPath(backendPath, start.slug, 'present', 'product'))
  await pollProductChannel(page).toMatchObject({
    product: 'failed',
    failure: { kind: 'render', message: frameFaultMessage('present') },
  })
  await expect
    .poll(
      () => page.evaluate(() => window.__harnessProductReports?.map((entry) => entry.outcome)),
      {
        timeout: productLoadBudgetMs,
      },
    )
    .toEqual(['failed'])
  expect(await page.evaluate(() => window.__harnessProductReports?.[0]?.model)).toBeNull()
  await expectProductAlert(page, start.slug, 'A presented frame failed')
  await settledStage(page)
  expect(await page.evaluate(() => window.__harnessProductReports?.length)).toBe(1)
})

test('a present fault reveals the failed swap and new content uses a fresh canvas', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  let environmentRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === stageConfig.environmentFile) environmentRequests += 1
  })
  const substitutions = await faultProductPresent(page, next)
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  const originalCanvas = await page.locator('canvas').elementHandle()
  await recordPhases(page)
  await rowControls(page, collection, start).next.click()
  await pollProductChannel(page).toMatchObject({
    product: 'failed',
    productSlug: next.slug,
    failure: { kind: 'render', message: frameFaultMessage('present') },
  })
  await waitForPhase(page, 'idle')
  expect(substitutions(), 'the fault composition reached the actual product module').toBe(1)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next])
  const reveals = (await recordedSnapshots(page)).filter((entry) => entry.phase === 'revealing')
  expect(reveals).toHaveLength(1)
  expect(reveals[0]).toMatchObject({ product: 'failed', productSlug: next.slug, model: null })
  await expectProductAlert(page, next.slug, 'A presented frame failed')
  await settledStage(page)
  const retiredFrames = await renderedFramesOf(page)

  await recordPhases(page)
  await rowControls(page, collection, next).next.click()
  await waitForRest(page, recovery)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [recovery])
  expect(await page.evaluate(() => window.__viewer?.model?.slug)).toBe(recovery.slug)
  expect(await renderedFramesOf(page)).toBeGreaterThan(retiredFrames)
  expect(await originalCanvas?.evaluate((canvas) => canvas.isConnected)).toBe(false)
  expect(environmentRequests).toBe(1)
  await expect(page.getByTestId('product-alert')).toHaveCount(0)
})
