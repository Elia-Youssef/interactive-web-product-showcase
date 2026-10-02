import { expect, test } from './fixtures'
import { productLoadBudgetMs } from './budgets'

// The dev-only stage-remount page: one store around a stage the toggle
// unmounts and mounts again, and a readout of the store's renderer status
// outside the stage. Every assertion reads a stable state, never a transient
// one, so the spec holds however fast a browser starts the new renderer. It
// runs on every matrix project, so the remount class is proven on both
// backends and every browser.
test('a remounted stage resets on unmount, then signals ready with its own frames', async ({
  page,
  backendPath,
  expectedBackend,
}) => {
  // The page carries the project's backend query, so the stage starts on
  // the same backend as the project's main page.
  const { search } = new URL(backendPath, 'https://stage-remount.invalid')
  await page.goto(`/stage-remount.html${search}`)
  const toggle = page.getByTestId('toggle-stage')
  const storeStatus = page.getByTestId('renderer-status')

  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.backend), {
      timeout: productLoadBudgetMs,
    })
    .toBe(expectedBackend)

  // Unmount: the stage's reset lands in the store, and the automation hook
  // leaves with the stage. Both hold until something mounts again.
  await toggle.click()
  await expect(storeStatus).toHaveText('initializing')
  await expect
    .poll(() => page.evaluate(() => window.__viewer === undefined), {
      timeout: productLoadBudgetMs,
    })
    .toBe(true)

  // Mount again: the new stage's observer signals its own first frame, so
  // the store turns ready and the new hook counts the new stage's frames.
  await toggle.click()
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await expect(storeStatus).toHaveText('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.renderedFrames ?? -1), {
      timeout: productLoadBudgetMs,
    })
    .toBeGreaterThanOrEqual(1)
})
