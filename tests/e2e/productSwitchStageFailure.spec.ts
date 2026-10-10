import { expect, test } from './fixtures'
import { productLoadBudgetMs, testBudgetMs } from './budgets'
import { loadCollection } from './productList'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import { composeTestModule } from './composeTestModule'
import {
  recordPhases,
  recordedPhases,
  waitForPhase,
  waitForRest,
  SWITCH_SEQUENCE,
} from './productSwitchFacts'
import { frameFaultMessage } from '../../src/app/product-harness/frameFaultQuery'
import { stageInitFaultMessage } from '../fixtures/stageInitFault.fixtures'

const collection = await loadCollection()
const start = collection.first
const next = neighborsOf(collection, start).next
const last = neighborsOf(collection, next).next

for (const timing of ['before covering', 'revealing'] as const) {
  test(`a stage frame failure ${timing} keeps completed outcomes and reveals its alert`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 3 }))
    await composeTestModule(page, {
      path: '/src/viewer/Stage.tsx',
      name: 'Stage',
      fixture: '/tests/fixtures/stageSwitchFault.fixtures.tsx',
      compose: 'renderWithStageFrameFault',
      args: [null],
    })
    await composeTestModule(page, {
      path: '/src/app/product-page/ProductStage.tsx',
      name: 'ProductStage',
      fixture: '/tests/fixtures/stageSwitchFault.fixtures.tsx',
      compose: 'renderRecordingSwitch',
      args: [timing === 'revealing'],
    })
    await page.goto(productPathOf(backendPath, start))
    await waitForRest(page, start)
    if (timing === 'revealing') {
      await rowControls(page, collection, start).next.click()
      await waitForPhase(page, 'revealing')
    }
    await page.evaluate(() => window.__failStageFrame?.())
    const alert = page.getByTestId('renderer-alert')
    await expect(alert).toContainText(frameFaultMessage('callback'))
    await page.evaluate(() => window.__resumeStageReveal?.())
    await waitForPhase(page, 'idle')
    await rowControls(page, collection, timing === 'revealing' ? next : start).next.click()
    if (timing === 'revealing') {
      await waitForPhase(page, 'revealing')
      await page.evaluate(() => window.__resumeStageReveal?.())
    }
    await waitForPhase(page, 'idle')
    await expect(alert).toBeVisible()
    await expect(page.getByTestId('product-alert')).toHaveCount(0)
    const outcomes =
      timing === 'revealing'
        ? [
            { life: 0, outcome: 'ready' },
            { life: 1, outcome: 'ready' },
            { life: 2, outcome: 'stage-failed' },
          ]
        : [
            { life: 0, outcome: 'ready' },
            { life: 1, outcome: 'stage-failed' },
          ]
    await expect
      .poll(() => page.evaluate(() => window.__stageSwitchOutcomes), {
        timeout: productLoadBudgetMs,
      })
      .toEqual(outcomes)
  })
}

for (const timing of ['before covering', 'covered'] as const) {
  test(`renderer init failure ${timing} reveals its own alert and ends later shown lives`, async ({
    page,
    backendPath,
    consoleGate,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 3 }))
    consoleGate.expectError(/The above error occurred in the <CanvasImpl> component/, { times: 1 })
    const fault = await composeTestModule(page, {
      path: '/src/viewer/rendererFactory.ts',
      name: 'createStageRenderer',
      fixture: '/tests/fixtures/stageInitFault.fixtures.ts',
      compose: 'createWithInitFault',
      args: [],
    })
    await composeTestModule(page, {
      path: '/src/app/product-page/ProductStage.tsx',
      name: 'ProductStage',
      fixture: '/tests/fixtures/stageSwitchFault.fixtures.tsx',
      compose: 'renderRecordingSwitch',
      args: [],
    })
    await page.goto(productPathOf(backendPath, start))
    await expect
      .poll(() => page.evaluate(() => window.__stageInitCalls), { timeout: productLoadBudgetMs })
      .toBe(1)
    if (timing === 'covered') {
      await rowControls(page, collection, start).next.click()
      await waitForPhase(page, 'covered')
    }
    await page.evaluate(() => window.__failStageInit?.())
    const alert = page.getByTestId('renderer-alert')
    await expect(alert).toContainText(stageInitFaultMessage)
    await waitForPhase(page, 'idle')
    expect(fault()).toBe(1)
    await rowControls(page, collection, timing === 'covered' ? next : start).next.click()
    await waitForPhase(page, 'idle')
    await expect(alert).toBeVisible()
    await expect(page.getByTestId('product-alert')).toHaveCount(0)
    const outcomes =
      timing === 'covered'
        ? [
            { life: 1, outcome: 'stage-failed' },
            { life: 2, outcome: 'stage-failed' },
          ]
        : [
            { life: 0, outcome: 'stage-failed' },
            { life: 1, outcome: 'stage-failed' },
          ]
    await expect
      .poll(() => page.evaluate(() => window.__stageSwitchOutcomes), {
        timeout: productLoadBudgetMs,
      })
      .toEqual(outcomes)
    expect(await page.evaluate(() => window.__stageInitCalls)).toBe(1)
  })
}

test('a stage frame failure mid switch reveals the renderer alert and later navigation ends', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  const fault = await composeTestModule(page, {
    path: '/src/viewer/Stage.tsx',
    name: 'Stage',
    fixture: '/tests/fixtures/stageSwitchFault.fixtures.tsx',
    compose: 'renderWithStageFrameFault',
    args: [next.slug],
  })
  await composeTestModule(page, {
    path: '/src/app/product-page/ProductStage.tsx',
    name: 'ProductStage',
    fixture: '/tests/fixtures/stageSwitchFault.fixtures.tsx',
    compose: 'renderRecordingSwitch',
    args: [],
  })
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)
  await rowControls(page, collection, start).next.click()
  const alert = page.getByTestId('renderer-alert')
  await expect(alert).toContainText(frameFaultMessage('callback'))
  await waitForPhase(page, 'idle')
  expect(fault(), 'the fault reached the real stage module').toBe(1)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expect(page.getByTestId('product-alert')).toHaveCount(0)
  await rowControls(page, collection, next).next.click()
  await waitForPhase(page, 'idle')
  await expect(alert).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__stageSwitchOutcomes), { timeout: productLoadBudgetMs })
    .toEqual([
      { life: 0, outcome: 'ready' },
      { life: 1, outcome: 'stage-failed' },
      { life: 2, outcome: 'stage-failed' },
    ])
  await expect(page.locator('[data-product-shown]')).toHaveAttribute(
    'data-product-shown',
    last.slug,
  )
  expect(
    await page.evaluate(() => ({
      status: window.__viewer?.status,
      product: window.__viewer?.product,
      failure: window.__viewer?.productFailure,
    })),
  ).toEqual({ status: 'failed', product: 'idle', failure: null })
})
