import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { countRegionPixelsBrighterThan } from './stagePixels'
import { settledStage } from './stageSettle'

// The collection's first product, as the app builds it from the manifests.
const first = (await loadCollection()).first

// The brightest pixel the CSS backdrop can produce: the background channels
// at 16/18/18 plus a white grid line at 0.025 alpha is about 22 per channel,
// and the vignette only darkens it. The ceiling sits far above that and far
// below the model's mid tones, so only model pixels can pass it.
const backdropCeiling = 60

test('the stage reports the collection first product as its model', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')

  // The model field is the contract: null until the model is in the scene,
  // then the counts the loaded scene measures, computed once on load. The
  // report lands after the renderer's compile, so the wait covers the whole
  // load under a busy matrix run.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      message: 'the stage must report its model once it is in the scene',
      timeout: 30000,
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
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), { timeout: 30000 })
    .not.toBeNull()

  // The report marks the stage's settled frame, and at rest nothing renders
  // that could drift between the poll and the capture.
  await settledStage(page)

  const stage = page.locator('[data-slot="stage"]')
  const stageBox = await stage.boundingBox()
  if (stageBox === null) {
    throw new Error('the stage slot must have a bounding box')
  }
  // The dev HUD and the chrome corners carry bright text of their own; they
  // are masked to black, so the count inside the stage box answers for the
  // model alone. The capture is the whole viewport: Chromium drops a
  // presented WebGPU canvas from element and clip captures, and only the
  // plain viewport capture carries it.
  const hud = page.getByTestId('dev-hud')
  const corners = [
    page.locator('[data-corner="top-left"]'),
    page.locator('[data-corner="top-right"]'),
    page.locator('[data-corner="bottom-left"]'),
    page.locator('[data-corner="bottom-right"]'),
  ]
  const withModel: Uint8Array = await page.screenshot({
    mask: [hud, ...corners],
    maskColor: '#000000',
  })

  const bright = await countRegionPixelsBrighterThan(
    page,
    withModel,
    { x: stageBox.x, y: stageBox.y, width: stageBox.width, height: stageBox.height },
    backdropCeiling,
  )
  expect(
    bright.count,
    `the model must paint stage pixels brighter than the backdrop (checked ${bright.total} pixels)`,
  ).toBeGreaterThan(0)
})
