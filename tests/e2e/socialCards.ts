// The page-side contract of the social card captures: the waits a card
// needs before its shot. It lives in the suite because the waits are page
// contracts written against the browser globals, like every other helper
// here, and because the settle it rides on is the suite's own.
import type { Page } from '@playwright/test'
import { productLoadBudgetMs } from './budgets'
import { settledForCapture } from './stageCapture'

// Waits for the presented product, through the automation hook the app
// installs in every build. A non-null model is a presented product, so the
// slug equality is the proof the card shows the route's own product.
async function waitForPresentedProduct(page: Page, slug: string): Promise<void> {
  await page.waitForFunction((expected) => window.__viewer?.model?.slug === expected, slug, {
    timeout: productLoadBudgetMs,
  })
}

// The rest a social card waits for: the route's own product presented, the
// suite's settle contract (the frame settle and the drained one-time DOM
// animations), and the shipped webfonts in place of a fallback face a
// first paint could still carry. After it, the viewport capture pins the
// landing frame: the load pose, the first finish, assembled.
export async function settledSocialCard(page: Page, slug: string): Promise<void> {
  await waitForPresentedProduct(page, slug)
  await settledForCapture(page)
  await page.evaluate(() => document.fonts.ready)
}
