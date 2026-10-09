import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import { composeTestModule } from './composeTestModule'
import { controlFrameSupply, holdFrames, releaseFrames } from './frameSupply'
import { pollProductChannel } from './productFailureChannel'
import { loadCollection } from './productList'
import { harnessPath, waitForProductReady } from './productSpecs'
import { waitForPhase, waitForRest } from './productSwitchFacts'
import { renderedFramesOf, settledStage } from './stageSettle'

const collection = await loadCollection()
const first = collection.first
const next = neighborsOf(collection, first).next

test('back and forward between products finish pending leave work without a console error', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  await controlFrameSupply(page)
  await page.goto(productPathOf(backendPath, first))
  await waitForRest(page, first)
  await settledStage(page)
  const before = await renderedFramesOf(page)
  await holdFrames(page)
  await rowControls(page, collection, first).next.click({ force: true })
  await waitForPhase(page, 'covered')
  await pollProductChannel(page).toMatchObject({ product: 'loading', productSlug: next.slug })
  expect(await renderedFramesOf(page), 'the pending leave has received no frames').toBe(before)
  await page.goBack()
  await pollProductChannel(page).toMatchObject({ product: 'loading', productSlug: first.slug })
  await releaseFrames(page)
  await waitForRest(page, first)
  await page.goForward()
  await waitForRest(page, next)
})

test('unmounting the harness stage ends a pending product leave quietly and remounts cleanly', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await controlFrameSupply(page)
  const substitutions = await composeTestModule(page, {
    path: '/src/viewer/Stage.tsx',
    name: 'Stage',
    fixture: '/tests/fixtures/mountableStage.fixtures.tsx',
    compose: 'renderMountableStage',
    args: [],
  })
  await page.goto(harnessPath(backendPath, first.slug))
  await waitForProductReady(page)
  await settledStage(page)
  const before = await renderedFramesOf(page)
  await holdFrames(page)
  // The frame supply is held, so these test controls dispatch their click
  // without the browser's frame-dependent actionability wait.
  await page.getByTestId('remount-product').dispatchEvent('click')
  await pollProductChannel(page).toMatchObject({ product: 'idle' })
  expect(await renderedFramesOf(page), 'the product leave is pending on a frame').toBe(before)
  await page.getByTestId('remount-stage').dispatchEvent('click')
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(await page.evaluate(() => window.__viewer)).toBeUndefined()
  expect(substitutions(), 'the control owns the actual stage').toBe(1)
  await releaseFrames(page)
  await page.getByTestId('remount-stage').dispatchEvent('click')
  await page.getByTestId('remount-product').dispatchEvent('click')
  await waitForProductReady(page)
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(await page.evaluate(() => window.__viewer?.model?.slug)).toBe(first.slug)
})
