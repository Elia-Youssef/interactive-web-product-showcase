import type { Page } from '@playwright/test'
import { testBodyBudgetMs } from './budgets'

// Waits until the exploded view rests at the target: the store asks for
// it, the spring has stopped, and the pose the last presented frame applied
// is the target itself. The condition is checked once per animation frame
// of the page, so a scrub that steps through targets is paced by the
// presented frames, never by a timer.
export async function waitForExplodeRestingAt(page: Page, target: number): Promise<void> {
  await page.waitForFunction(
    (expected: number) => {
      const explode = window.__viewer?.explode
      return (
        explode !== null &&
        explode !== undefined &&
        explode.target === expected &&
        !explode.moving &&
        explode.t === expected
      )
    },
    target,
    { polling: 'raf', timeout: testBodyBudgetMs },
  )
}
