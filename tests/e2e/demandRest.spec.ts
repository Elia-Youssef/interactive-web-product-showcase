import { expect, test } from './fixtures'
import { productLoadBudgetMs, restWindowBudgetMs, testBodyBudgetMs } from './budgets'
import { requireCamera } from './hotspotViews'
import { renderedFramesOf, settledFrames } from './stageSettle'
import { hudRestText } from '../../src/viewer/hud/restText'

test('the stage stands still at rest and renders again on a resize', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.ready), {
      timeout: productLoadBudgetMs,
    })
    .toBe(true)

  // The stage's load work (model, camera fit, the settle's presents) owes frames
  // of its own after ready; the at-rest measurement starts once it is in,
  // so the settle window below measures rest, not a late load frame.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      timeout: productLoadBudgetMs,
    })
    .not.toBeNull()

  // At rest under demand mode, with the HUD mounted: nothing renders
  // through the suite's rest window.
  const framesAtRest = await settledFrames(page)
  await page.waitForTimeout(restWindowBudgetMs)
  expect(await renderedFramesOf(page)).toBe(framesAtRest)

  // The HUD's rolling window has passed, so its FPS reads its rest text.
  await expect(page.getByTestId('hud-fps')).toHaveText(hudRestText.fps)

  // A viewport resize owes a frame, and the renderer renders it.
  await page.setViewportSize({ width: 900, height: 600 })
  await expect
    .poll(() => renderedFramesOf(page), {
      message: 'the resize must render at least one frame',
      timeout: testBodyBudgetMs,
    })
    .toBeGreaterThan(framesAtRest)
})

// A page scroll moves the canvas without changing its box, and rendering
// depends on the box alone, so a scroll at rest owes no frame and no camera
// change. The scrolling-document layout (a window shorter than the page
// scroll breakpoint) is the one where the document itself scrolls the
// canvas; every action that reveals content by scrolling shares the path.
test('a page scroll at rest renders no frame and moves no camera', async ({
  page,
  backendPath,
}) => {
  // A phone-width window short enough to be one scrolling document.
  await page.setViewportSize({ width: 600, height: 400 })
  await page.goto(backendPath)
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.model ?? null), {
      timeout: productLoadBudgetMs,
    })
    .not.toBeNull()

  const framesAtRest = await settledFrames(page)
  const cameraAtRest = await requireCamera(page)

  await page.evaluate(() => window.scrollTo(0, 150))
  // The premise: the document really scrolled, so the canvas really moved.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  // The canvas measurement's own debounce, then the suite's rest window: a
  // scroll that owed a frame would have rendered it here.
  await page.waitForTimeout(restWindowBudgetMs)

  expect(await renderedFramesOf(page)).toBe(framesAtRest)
  expect(await requireCamera(page)).toEqual(cameraAtRest)
})
