import { expect, test } from './fixtures'

// The dev-only stage-remount page: one store around a stage keyed by a
// counter, with a button that bumps the key. The spec drives it on every
// matrix project, so the remount class is proven on both backends and every
// browser.
test('a remounted stage re-initializes, signals ready and counts its own frames', async ({
  page,
  backendPath,
  expectedBackend,
}) => {
  // The page carries the project's backend query, so the stage starts on
  // the same backend as the project's main page.
  const { search } = new URL(backendPath, 'https://stage-remount.invalid')
  await page.goto(`/stage-remount.html${search}`)

  await expect.poll(() => page.evaluate(() => window.__viewer?.backend)).toBe(expectedBackend)
  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')
  const framesBefore = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)

  await page.getByTestId('remount-stage').click()

  // The new stage passes back through initializing before it is ready
  // again: the reset of the old stage lands in the store, and the new
  // stage's observer only signals its own first frame. One snapshot holds
  // status, ready and the frame count together, so no transition can slip
  // between two polls. The tight interval keeps the initializing window,
  // which lasts as long as the new renderer's start-up, observable.
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          status: window.__viewer?.status,
          ready: window.__viewer?.ready,
          frames: window.__viewer?.renderedFrames ?? -1,
        })),
      { intervals: [5] },
    )
    .toEqual({ status: 'initializing', ready: false, frames: 0 })

  await expect.poll(() => page.evaluate(() => window.__viewer?.status)).toBe('ready')

  // The new stage counts its own frames from zero and grows past the first.
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.renderedFrames ?? -1))
    .toBeGreaterThanOrEqual(1)
  expect(framesBefore).toBeGreaterThanOrEqual(1)
})
