import { test } from './fixtures'

// This file exists to prove the clean-page gate covers spec files in load
// order, not only the first file each worker loads. It sorts before its twin
// console-gate-2-second-file.spec.ts, and the gate-proof project runs on one
// worker, so that file always loads second on a worker that has already
// loaded this one.
test('gate proof: a clean page passes in the first spec file a worker loads', async ({ page }) => {
  await page.evaluate(() => 'clean')
})
