import { expect, type Page } from '@playwright/test'
import { productModelUrl, type Product } from '../../src/lib/product'
import type { ProductTransitionPhase } from '../../src/lib/transition'
import { productLoadBudgetMs } from './budgets'
import { expectProduct } from './collectionFacts'

// The reads and waits of the product switch proofs: the transition's phase
// as the switch layer names it, a record of every phase the layer went
// through and of every swap of the shown product, the rest of a product,
// and the stage's model loads.

// The attributes the switch layer names its running phase and the product
// the stage shows with.
const PHASE_ATTRIBUTE = 'data-product-transition'
const SHOWN_ATTRIBUTE = 'data-product-shown'
const LAYER_ATTRIBUTES = { phase: PHASE_ATTRIBUTE, shown: SHOWN_ATTRIBUTE } as const

// One switch, in the only order the contract allows.
export const SWITCH_SEQUENCE: readonly ProductTransitionPhase[] = [
  'covering',
  'covered',
  'revealing',
  'idle',
]

// What the page held when a phase change was observed.
export type PhaseSnapshot = {
  readonly phase: string | null
  readonly product: string | null
  readonly productSlug: string | null
}

// One change of the product the stage shows, with the layer's phase at
// that moment.
export type ShownSwap = {
  readonly from: string | null
  readonly to: string | null
  readonly phase: string | null
}

type PhaseLog = {
  readonly before: (string | null)[]
  readonly snapshots: PhaseSnapshot[]
  readonly swaps: ShownSwap[]
}

declare global {
  interface Window {
    __switchPhaseLog?: PhaseLog
  }
}

// Installs the page's phase recorder: every change of the layer's phase
// attribute, anywhere in the document, is recorded by the value it changed
// from, so the record misses no phase however the page batches its
// mutations, plus what the automation reported when the change was seen.
// Every change of the shown product is recorded with the phase the layer
// holds as the change lands: the stage swaps in the same commit that names
// the new product, so the phase read with it is the phase of the swap.
// Usable as an init script, before the app renders, and on a live page.
export function installPhaseRecorder(attributes: typeof LAYER_ATTRIBUTES): void {
  const log: PhaseLog = { before: [], snapshots: [], swaps: [] }
  window.__switchPhaseLog = log
  const read = (attribute: string) =>
    document.querySelector(`[${attribute}]`)?.getAttribute(attribute) ?? null
  let shown = read(attributes.shown)
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === attributes.phase) {
        log.before.push(record.oldValue)
      }
    }
    const phase = read(attributes.phase)
    const nowShown = read(attributes.shown)
    if (nowShown !== shown) {
      log.swaps.push({ from: shown, to: nowShown, phase })
      shown = nowShown
    }
    log.snapshots.push({
      phase,
      product: window.__viewer?.product ?? null,
      productSlug: window.__viewer?.productSlug ?? null,
    })
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: [attributes.phase, attributes.shown],
    attributeOldValue: true,
  })
}

export async function recordPhases(page: Page): Promise<void> {
  await page.evaluate(installPhaseRecorder, LAYER_ATTRIBUTES)
}

export async function recordPhasesFromStart(page: Page): Promise<void> {
  await page.addInitScript(installPhaseRecorder, LAYER_ATTRIBUTES)
}

// Every phase the layer entered since the recorder started, in order: the
// value each change moved to is the value the next change moved from, and
// the last one is the layer's phase now.
export async function recordedPhases(page: Page): Promise<readonly (string | null)[]> {
  return page.evaluate((attribute) => {
    const log = window.__switchPhaseLog
    if (log === undefined) {
      throw new Error('the phase recorder is not installed')
    }
    if (log.before.length === 0) {
      return []
    }
    const now = document.querySelector(`[${attribute}]`)?.getAttribute(attribute) ?? null
    return [...log.before.slice(1), now]
  }, PHASE_ATTRIBUTE)
}

export async function recordedSnapshots(page: Page): Promise<readonly PhaseSnapshot[]> {
  return page.evaluate(() => window.__switchPhaseLog?.snapshots ?? [])
}

// Every swap of the shown product since the recorder started, in order.
export async function recordedSwaps(page: Page): Promise<readonly ShownSwap[]> {
  return page.evaluate(() => window.__switchPhaseLog?.swaps ?? [])
}

// The stage swapped exactly through the given products, in order, and every
// swap landed on a covered stage: never while the old product was still in
// view, never while the new one was being revealed.
export async function expectSwapsUnderCover(
  page: Page,
  products: readonly Product[],
): Promise<void> {
  const swaps = await recordedSwaps(page)
  expect(
    swaps.map((swap) => swap.to),
    'the products the stage swapped to',
  ).toEqual(products.map((product) => product.slug))
  for (const swap of swaps) {
    expect(swap.phase, `the phase of the swap from ${swap.from} to ${swap.to}`).toBe('covered')
  }
}

// The layer's phase now.
export function switchPhase(page: Page): Promise<string | null> {
  return page.evaluate(
    (attribute) => document.querySelector(`[${attribute}]`)?.getAttribute(attribute) ?? null,
    PHASE_ATTRIBUTE,
  )
}

export async function waitForPhase(page: Page, phase: ProductTransitionPhase): Promise<void> {
  await expect.poll(() => switchPhase(page), { timeout: productLoadBudgetMs }).toBe(phase)
}

// The product is at rest: presented, and no switch runs.
export async function waitForRest(page: Page, product: Product): Promise<void> {
  await expectProduct(page, product)
  await waitForPhase(page, 'idle')
}

// The stage's model loads as the automation reports them.
export function stageLoads(page: Page) {
  return page.evaluate(() => window.__viewer?.loads ?? null)
}

export function modelUrlOf(product: Product): string {
  return productModelUrl(product.slug)
}

// Holds every request for the product's model file until the release, then
// lets each through: a load of it stays running for as long as the test
// wants. Answers the release and the count of requests seen so far.
export async function holdModelRequests(page: Page, product: Product) {
  let release: () => void = () => {
    throw new Error('the model hold was released before it was installed')
  }
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route(`**${modelUrlOf(product)}`, async (route) => {
    requests += 1
    await released
    await route.continue()
  })
  return { release: () => release(), requests: () => requests }
}

// Counts every request for any model file, letting each through. A routed
// page bypasses the browser's HTTP cache, so every read of a file is one
// request here.
export async function countModelRequests(page: Page) {
  const counts = new Map<string, number>()
  await page.route('**/models/**/model.glb', async (route) => {
    const path = new URL(route.request().url()).pathname
    counts.set(path, (counts.get(path) ?? 0) + 1)
    await route.continue()
  })
  return (product: Product) => counts.get(modelUrlOf(product)) ?? 0
}
