import { productModelUrl } from '../../src/lib/product'
import { stageConfig } from '../../src/viewer/config'
import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { harnessPath } from './productSpecs'
import { holdAsset } from './heldAssetRoute'
import { observeAssetEnvironment, observeAssetOwnership } from './assetOwnershipRoute'

const first = (await loadCollection()).first
const modelUrl = productModelUrl(first.slug)

test('the model downloads while the environment response is held, once per life', async ({
  page,
  backendPath,
  expectedBackend,
  expectedBrowserName,
}, testInfo) => {
  // The development module graph exceeds the browser's default buffer.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(1000))
  const observed = await observeAssetOwnership(page)
  let modelRequests = 0
  let environmentHeld = false
  let releaseEnvironment: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    releaseEnvironment = resolve
  })
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === modelUrl) {
      modelRequests += 1
    }
  })
  await page.route(`**${stageConfig.environmentFile}`, async (route) => {
    environmentHeld = true
    await released
    await route.continue()
  })

  try {
    await page.goto(backendPath)
    await expect.poll(() => modelRequests, { timeout: productLoadBudgetMs }).toBe(1)
    expect(environmentHeld).toBe(true)
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__assetModelOwners?.some((owner) => owner.events.includes('parse finished')),
          ),
        { timeout: productLoadBudgetMs },
      )
      .toBe(true)
    await settledFrames(page)
    expect(await page.evaluate(() => window.__viewer?.model)).toBeNull()
    expect(await page.evaluate(() => window.__viewer?.product)).toBe('loading')
  } finally {
    releaseEnvironment()
  }
  await waitForProductReady(page)
  await settledFrames(page)
  expect(modelRequests).toBe(1)
  expect(observed()).toBe(1)
  expect(await page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)
  if (expectedBrowserName === 'chromium') {
    const offset = await page.evaluate(
      ({ model, environment }) => {
        const resources = performance.getEntriesByType('resource')
        const read = (path: string) =>
          resources.find((entry) => new URL(entry.name).pathname === path)
        const modelEntry = read(model)
        const environmentEntry = read(environment)
        return modelEntry instanceof PerformanceResourceTiming &&
          environmentEntry instanceof PerformanceResourceTiming
          ? modelEntry.startTime - environmentEntry.responseEnd
          : null
      },
      { model: modelUrl, environment: stageConfig.environmentFile },
    )
    await testInfo.attach('model-start-minus-environment-end-ms', {
      body: JSON.stringify(offset),
      contentType: 'application/json',
    })
  }
})

test('an environment failure drains the model that is still in flight', async ({
  page,
  backendPath,
  expectedBrowserName,
  consoleGate,
}) => {
  const observed = await observeAssetOwnership(page)
  const environment = await holdAsset(page, stageConfig.environmentFile)
  const model = await holdAsset(page, modelUrl)
  consoleGate.expectError(/The above error occurred in the <CanvasImpl> component/, { times: 1 })
  consoleGate.expectError(
    /page error: (Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)/,
    { times: 1 },
  )
  if (expectedBrowserName === 'chromium') {
    consoleGate.expectError(/Failed to load resource|net::/, { times: 1 })
  }
  try {
    await page.goto(backendPath)
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
    expect(environment.isHeld()).toBe(true)
    environment.release('abort')
    await expect(page.getByTestId('renderer-alert')).toBeVisible()
    expect(await page.evaluate(() => window.__viewer?.status)).toBe('failed')
    await expect
      .poll(() => page.evaluate(() => window.__viewer?.loads), {
        timeout: productLoadBudgetMs,
      })
      .toEqual({ models: [], bytes: [], settling: 1 })
  } finally {
    environment.release()
    model.release()
  }
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.loads), {
      timeout: productLoadBudgetMs,
    })
    .toEqual({ models: [], bytes: [], settling: 0 })
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__assetModelOwners
            ?.filter((owner) => owner.events.includes('bytes started'))
            .every((owner) => owner.events.includes('decoder disposed')),
        ),
      { timeout: productLoadBudgetMs },
    )
    .toBe(true)
  expect(await page.evaluate(() => window.__viewer?.loads)).toEqual({
    models: [],
    bytes: [],
    settling: 0,
  })
  expect(observed()).toBe(1)
})

test('a held model stays unpresented with fast lighting and reports ready once after release', async ({
  page,
  backendPath,
}) => {
  const environmentObserved = await observeAssetEnvironment(page)
  const model = await holdAsset(page, modelUrl)
  try {
    await page.goto(harnessPath(backendPath, first.slug))
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
    await expect
      .poll(() => page.evaluate(() => window.__assetEnvironments?.[0]?.events.includes('loaded')), {
        timeout: productLoadBudgetMs,
      })
      .toBe(true)
    expect(await page.evaluate(() => window.__viewer?.product)).toBe('loading')
    expect(await page.evaluate(() => window.__viewer?.model)).toBeNull()
    expect(await page.evaluate(() => window.__harnessProductReports)).toEqual([])
  } finally {
    model.release()
  }
  await waitForProductReady(page)
  await settledFrames(page)
  expect(
    await page.evaluate(() => window.__harnessProductReports?.map((entry) => entry.outcome)),
  ).toEqual(['ready'])
  expect(environmentObserved()).toBe(1)
})

test('a failed model reaches its product channel while the environment is still held', async ({
  page,
  backendPath,
  expectedBrowserName,
  consoleGate,
}) => {
  const environment = await holdAsset(page, stageConfig.environmentFile)
  const model = await holdAsset(page, modelUrl)
  if (expectedBrowserName === 'chromium') {
    consoleGate.expectError(/Failed to load resource|net::/, { times: 1 })
  }
  try {
    await page.goto(harnessPath(backendPath, first.slug))
    await expect.poll(model.isHeld, { timeout: productLoadBudgetMs }).toBe(true)
    model.release('abort')
    await expect
      .poll(() => page.evaluate(() => window.__viewer?.product), {
        timeout: productLoadBudgetMs,
      })
      .toBe('failed')
    expect(environment.isHeld()).toBe(true)
    expect(await page.evaluate(() => window.__viewer?.productFailure?.kind)).toBe('load')
    await expect(page.getByTestId('product-alert')).toBeVisible()
  } finally {
    environment.release()
    model.release('abort')
  }
  await settledFrames(page)
  expect(
    await page.evaluate(() => window.__harnessProductReports?.map((entry) => entry.outcome)),
  ).toEqual(['failed'])
})
