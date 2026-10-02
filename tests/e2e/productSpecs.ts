import { expect, type Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { productLoadBudgetMs } from './budgets'
import { loadCollection } from './productList'

export { productLoadBudgetMs }

// The products under test: every shipped product, as the collection's own
// validation parsed them, so the explode block is normalized exactly as the
// runtime sees it. The specs register per product from this list; a product
// that joins the set is under test without a change here.
export async function harnessProducts(): Promise<readonly Product[]> {
  return (await loadCollection()).products
}

// The harness page URL for this project's backend mode, with the product's
// slug parameter set.
export function harnessPath(backendPath: string, slug: string): string {
  const params = new URLSearchParams(new URL(backendPath, 'https://harness.invalid').search)
  params.set('slug', slug)
  return `/product-harness.html?${params.toString()}`
}

// Polls the page until the evaluate agrees with the expectation. The budget
// is a required argument, so no poll in the suite rides the runner's
// implicit 5 s default: a poll names the allowance it needs, from the
// budget module, the way every other wait in the suite does.
export function expectPoll(page: Page, evaluate: () => unknown, budgetMs: number) {
  return expect.poll(() => page.evaluate(evaluate), { timeout: budgetMs })
}

// Waits until the page's product is ready, which is the store's word that
// the product is on a recorded frame: the stage settle around the mounted,
// centered and framed product has resolved.
export async function waitForProductReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.status), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.product), {
      timeout: productLoadBudgetMs,
    })
    .toBe('ready')
}

// Waits until the page's stage warm-up has drawn its one-frame physical
// material and removed it, so the renderer's lazily created internals all
// exist and the memory baseline is the settled empty stage. The flag only
// lands after the renderer has started, which on the software-rendered
// WebKit build stretches past the expect default under the matrix's own
// load, so it rides the same budget as the product it precedes.
export async function waitForStageWarm(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__harnessStageWarm), {
      timeout: productLoadBudgetMs,
    })
    .toBe(true)
}

export type RendererMemory = { readonly geometries: number; readonly textures: number }

// Waits for the renderer's memory counters to settle: three reads half a
// second apart that agree, and, when a floor is given, grown past it. The
// product's resources land in GPU memory during the frames that draw it,
// and the browser's own bookkeeping lags a beat behind both mount and
// teardown, so a settled reading is the only stable one; the floor makes
// the same wait serve the mounted side of the disposal proof.
export async function waitForSettledMemory(
  page: Page,
  floor?: RendererMemory,
): Promise<RendererMemory> {
  await expect
    .poll(
      async () => {
        const read = () => page.evaluate(() => window.__harnessRendererMemory?.())
        const first = await read()
        await page.waitForTimeout(500)
        const second = await read()
        await page.waitForTimeout(500)
        const third = await read()
        if (first === undefined || second === undefined || third === undefined) {
          return false
        }
        const settled =
          first.geometries === second.geometries &&
          first.textures === second.textures &&
          second.geometries === third.geometries &&
          second.textures === third.textures
        if (!settled) {
          return false
        }
        return (
          floor === undefined ||
          (second.geometries > floor.geometries && second.textures > floor.textures)
        )
      },
      // A fresh mount re-uploads everything, which is slow on the WebKit
      // builds, so the settle wait gets room of its own.
      { timeout: productLoadBudgetMs },
    )
    .toBe(true)
  const settled = await page.evaluate(() => window.__harnessRendererMemory?.())
  if (settled === undefined) {
    throw new Error('the harness renderer memory probe is missing')
  }
  return settled
}
