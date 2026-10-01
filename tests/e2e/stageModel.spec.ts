import type { Page } from '@playwright/test'
import { productModelUrl } from '../../src/lib/product'
import { stageConfig } from '../../src/viewer/config'
import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { productLoadBudgetMs } from './productSpecs'
import { countRegionPixelsBrighterThan, type BrightPixels } from './stagePixels'
import { settledFrames, settledStage } from './stageSettle'

// The collection's first product, as the app builds it from the manifests.
const first = (await loadCollection()).first

// The brightest pixel the CSS backdrop can produce: the background channels
// at 16/18/18 plus a white grid line at 0.025 alpha is about 22 per channel,
// and the vignette only darkens it. The ceiling sits far above that and far
// below the model's mid tones, so only model pixels can pass it.
const backdropCeiling = 60

// Captures the viewport and counts the stage pixels the product paints. The
// dev HUD and the chrome corners carry bright text of their own; they are
// masked to black, so the count inside the stage box answers for the product
// alone. The capture is the whole viewport: Chromium drops a presented WebGPU
// canvas from element and clip captures, and only the plain viewport capture
// carries it. The capture comes first and the measuring after it, so nothing
// stands between the caller's wait and the pixels.
async function productPixels(page: Page): Promise<BrightPixels> {
  const capture: Uint8Array = await page.screenshot({
    mask: [
      page.getByTestId('dev-hud'),
      page.locator('[data-corner="top-left"]'),
      page.locator('[data-corner="top-right"]'),
      page.locator('[data-corner="bottom-left"]'),
      page.locator('[data-corner="bottom-right"]'),
    ],
    maskColor: '#000000',
  })
  const stageBox = await page.locator('[data-slot="stage"]').boundingBox()
  if (stageBox === null) {
    throw new Error('the stage slot must have a bounding box')
  }
  return countRegionPixelsBrighterThan(page, capture, stageBox, backdropCeiling)
}

test('the stage reports the collection first product as its model', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')

  // The model field is the contract: null until the product is presented,
  // then the counts the loaded scene measured, read from the store's ready
  // status. Ready means a recorded frame, so the wait covers the whole load
  // under a busy matrix run.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      message: 'the stage must report its model once the product is presented',
      timeout: productLoadBudgetMs,
    })
    .not.toBeNull()
  const model = await page.evaluate(() => window.__viewer?.model ?? null)
  if (model === null) {
    throw new Error('the model report vanished between the poll and the read')
  }
  expect(model.slug).toBe(first.slug)
  expect(model.meshes).toBeGreaterThanOrEqual(1)
  expect(model.triangles).toBeGreaterThanOrEqual(1)
})

test('the stage renders the model: its pixels rise above the bare backdrop', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      timeout: productLoadBudgetMs,
    })
    .not.toBeNull()

  // The report marks the stage's settled frame, and at rest nothing renders
  // that could drift between the poll and the capture.
  await settledStage(page)

  const bright = await productPixels(page)
  expect(
    bright.count,
    `the model must paint stage pixels brighter than the backdrop (checked ${bright.total} pixels)`,
  ).toBeGreaterThan(0)
})

test('the stage loads its environment and the product model once each', async ({
  page,
  backendPath,
}) => {
  // A resource the stage's content still renders is never released under it:
  // a release while mounted would empty the loader cache, the next render
  // would suspend the stage's content and load the file again, and the
  // product would leave the frame until the reload lands.
  const watched = [stageConfig.environmentFile, productModelUrl(first.slug)]
  const fetches = new Map(watched.map((path) => [path, 0]))
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    const count = fetches.get(path)
    if (count !== undefined) {
      fetches.set(path, count + 1)
    }
  })

  await page.goto(backendPath)
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.product), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await settledFrames(page)

  expect(Object.fromEntries(fetches)).toEqual(Object.fromEntries(watched.map((path) => [path, 1])))
})

test('the product is on the stage pixels the moment it reports ready', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)

  // The wait reads the product status on every animation frame and the
  // capture follows at once, with no settle wait in between: a ready status
  // that lands before the product is on a recorded frame fails the count.
  // The load gets the one budget every ready wait carries.
  const readyAt = await page.waitForFunction(
    () => (window.__viewer?.product === 'ready' ? window.__viewer.renderedFrames : null),
    undefined,
    { polling: 'raf', timeout: productLoadBudgetMs },
  )
  const framesAtReady = await readyAt.jsonValue()
  const bright = await productPixels(page)

  expect(
    bright.count,
    `the product must be drawn when ready lands at frame ${framesAtReady} (checked ${bright.total} pixels)`,
  ).toBeGreaterThan(0)
})
