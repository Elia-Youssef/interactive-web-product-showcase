import { isDeepStrictEqual } from 'node:util'
import { expect, type Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import type { ViewerRendererMemory } from '../../src/viewer/automation/viewerAutomation'
import { productLoadBudgetMs } from './budgets'
import { loadCollection, loadTestCollection } from './productList'
import { resolveE2ETier, sampleProducts } from './tiers'

export { productLoadBudgetMs }

// The products under test: the shipped collection plus the fixture
// products, as the dev harness presents them (one collection the product
// domain's own validation parsed), so the explode block is normalized
// exactly as the runtime sees it. The specs register per product from this
// list; a fixture product that joins tests/fixtures/products is under test
// without a change here, and a spec driving the site's own pages reads the
// shipped set alone (shippedProducts below).
export async function harnessProducts(): Promise<readonly Product[]> {
  return (await loadTestCollection()).products
}

// The shipped collection's products alone, the set a spec driving the site's
// own pages (productPathOf) reads: a fixture product has no site route.
export async function shippedProducts(): Promise<readonly Product[]> {
  return (await loadCollection()).products
}

// The products a product independent spec covers: a sample of the shipped
// set in the tiered run, the whole set under the full switch.
export async function sampledHarnessProducts(): Promise<readonly Product[]> {
  return sampleProducts(await harnessProducts(), resolveE2ETier(process.env))
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

// The presents of one settle: a product's leave settles the stage like any
// other scene mutation.
const LEAVE_PRESENTS = 2

function renderedFrames(page: Page): Promise<number> {
  return page.evaluate(() => window.__viewer?.renderedFrames ?? 0)
}

// Takes the harness's product off the stage and waits for the leave to land:
// the store's product is idle, and the stage has presented itself without
// the product, so the engine let go of the frame callbacks it ran for it.
export async function leaveProduct(page: Page): Promise<void> {
  const framesBeforeLeave = await renderedFrames(page)
  await page.getByTestId('remount-product').click()
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.product), { timeout: productLoadBudgetMs })
    .toBe('idle')
  await expect
    .poll(() => renderedFrames(page), { timeout: productLoadBudgetMs })
    .toBeGreaterThanOrEqual(framesBeforeLeave + LEAVE_PRESENTS)
}

// The stage's memory probe reading: the renderer's resource counters with
// their byte sizes, and the WebGL2 fallback's vertex array cache.
export type RendererMemory = ViewerRendererMemory

// Waits for the renderer's memory counters to settle: three reads half a
// second apart that agree on every counter, and, when a floor is given,
// grown past it. The
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
        const read = () => page.evaluate(() => window.__viewer?.memory ?? null)
        const first = await read()
        await page.waitForTimeout(500)
        const second = await read()
        await page.waitForTimeout(500)
        const third = await read()
        if (first === null || second === null || third === null) {
          return false
        }
        const settled = isDeepStrictEqual(first, second) && isDeepStrictEqual(second, third)
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
  const settled = await page.evaluate(() => window.__viewer?.memory ?? null)
  if (settled === null) {
    throw new Error('the stage memory probe is missing')
  }
  return settled
}
