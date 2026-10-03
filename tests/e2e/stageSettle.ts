import { expect, type Page } from '@playwright/test'
import { hudDrainBudgetMs } from './budgets'

// Waits until the stage's frame count holds still across a settle window:
// every load-frame debt (the model, the camera fit) is paid, and the stage
// is at rest under demand mode, so nothing renders between two reads that
// follow. Returns the frame count it settled on.
export async function settledFrames(page: Page, settleWindowMs = 400): Promise<number> {
  let reference = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
  for (;;) {
    await page.waitForTimeout(settleWindowMs)
    const current = await page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
    if (current === reference) {
      return current
    }
    reference = current
  }
}

// Waits for the fully settled stage: no frame in flight, and the dev HUD
// showing its at-rest values. The HUD's rolling window drains about a second
// after the last frame; from then on its text is static, so a screenshot
// mask that hugs the HUD covers the same box on every run.
export async function settledStage(page: Page): Promise<void> {
  await settledFrames(page)
  const hud = page.getByTestId('dev-hud')
  if ((await hud.count()) === 0) {
    return
  }
  // The HUD drain budget from the suite's budget module: the rolling
  // window's fall to the rest text, an order of magnitude above the drain.
  await expect(page.getByTestId('hud-fps')).toHaveText('0.0', { timeout: hudDrainBudgetMs })
  await expect(page.getByTestId('hud-tick-cpu')).toHaveText('-', { timeout: hudDrainBudgetMs })
}
