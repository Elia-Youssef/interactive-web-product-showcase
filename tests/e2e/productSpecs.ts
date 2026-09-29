import { expect, type Page } from '@playwright/test'
import { parseProduct, type Product } from '../../src/lib/product'
import { manifest as speakerManifest } from '../../src/products/placeholder-speaker.manifest.ts'

// The product under test, parsed through the schema so the explode block is
// normalized exactly as the runtime sees it.
export function harnessProduct(): Product {
  return parseProduct(speakerManifest, 'product.spec')
}

// The harness page URL for this project's backend mode, with the product's
// slug parameter set.
export function harnessPath(backendPath: string, slug: string): string {
  const params = new URLSearchParams(new URL(backendPath, 'https://harness.invalid').search)
  params.set('slug', slug)
  return `/product-harness.html?${params.toString()}`
}

export function expectPoll(page: Page, evaluate: () => unknown) {
  return expect.poll(() => page.evaluate(evaluate))
}

// Waits until the page's product is ready, which is the store's word that
// the model loaded and its rig parsed.
export async function waitForProductReady(page: Page): Promise<void> {
  await expectPoll(page, () => window.__viewer?.status).toBe('ready')
  await expectPoll(page, () => window.__viewer?.product).toBe('ready')
}

// Waits until the page's stage warm-up has drawn its one-frame physical
// material and removed it, so the renderer's lazily created internals all
// exist and the memory baseline is the settled empty stage.
export async function waitForStageWarm(page: Page): Promise<void> {
  await expectPoll(page, () => window.__harnessStageWarm).toBe(true)
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
      { timeout: 30_000 },
    )
    .toBe(true)
  const settled = await page.evaluate(() => window.__harnessRendererMemory?.())
  if (settled === undefined) {
    throw new Error('the harness renderer memory probe is missing')
  }
  return settled
}
