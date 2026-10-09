import { expect, type Page } from '@playwright/test'
import { test } from './fixtures'
import { testBudgetMs, testBodyBudgetMs } from './budgets'
import { overlayKey } from '../../src/lib/hotspots/hotspotKeys'
import type { Product } from '../../src/lib/product'
import { loadCollection } from './productList'
import { neighborsOf, productPathOf, rowControls } from './collectionFacts'
import {
  SWITCH_SEQUENCE,
  countModelRequests,
  expectSwapsUnderCover,
  holdModelRequests,
  modelUrlOf,
  recordPhases,
  recordPhasesFromStart,
  recordedPhases,
  recordedSnapshots,
  stageLoads,
  switchPhase,
  waitForPhase,
  waitForRest,
} from './productSwitchFacts'
import { switchBandRed } from './switchBandRed'

// The product switch proofs run on the app itself, over the real
// collection: one stage lives across every move, every way the route moves
// runs the same cover, swap and reveal, a navigation during a switch
// retargets it, and a product that leaves the stage takes its load, its
// overlay placements and nothing else with it.

const collection = await loadCollection()
const start = collection.first
const next = neighborsOf(collection, start).next
const afterNext = neighborsOf(collection, next).next

// The overlay keys the shown product's hotspots write, from the stage's own
// report of the rig's hotspots.
async function shownOverlayKeys(page: Page): Promise<string[]> {
  const hotspots = await page.evaluate(() => window.__viewer?.hotspots ?? null)
  return (hotspots?.hotspots ?? []).map((hotspot) => overlayKey(hotspot.id)).sort()
}

async function overlayPlacementKeys(page: Page): Promise<string[]> {
  const overlay = await page.evaluate(() => window.__viewer?.overlay ?? null)
  return Object.keys(overlay?.placements ?? {}).sort()
}

// The page rests on one product alone: one model load, no released load
// still waiting, and only that product's markers in the overlay channel.
async function expectRestingAlone(page: Page, product: Product): Promise<void> {
  await expect
    .poll(() => stageLoads(page), { timeout: testBodyBudgetMs })
    .toMatchObject({ models: [modelUrlOf(product)], settling: 0 })
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.hotspots?.product ?? null), {
      timeout: testBodyBudgetMs,
    })
    .toBe(product.slug)
  expect(await overlayPlacementKeys(page)).toEqual(await shownOverlayKeys(page))
}

test('a move to the next product covers, swaps, reveals once in order, and rests on it alone', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)

  await rowControls(page, collection, start).next.click()
  await waitForRest(page, next)

  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  // The swap happens only under the cover: the one change of the shown
  // product landed on the covered stage, and once the reveal started, the
  // next product was presented.
  await expectSwapsUnderCover(page, [next])
  for (const snapshot of await recordedSnapshots(page)) {
    if (snapshot.phase === 'revealing' || snapshot.phase === 'idle') {
      expect(snapshot).toMatchObject({ productSlug: next.slug, product: 'ready' })
    }
  }
  await expectRestingAlone(page, next)
})

test('back and forward run the same switch as a click', async ({ page, backendPath }) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await rowControls(page, collection, start).next.click()
  await waitForRest(page, next)

  await recordPhases(page)
  await page.goBack()
  await waitForRest(page, start)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [start])
  await expectRestingAlone(page, start)

  await recordPhases(page)
  await page.goForward()
  await waitForRest(page, next)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next])
  await expectRestingAlone(page, next)
})

test('a deep link presents its product at once, with no switch to run', async ({
  page,
  backendPath,
}) => {
  const deep = collection.products.at(-1)
  if (deep === undefined) {
    throw new Error('the collection holds no product')
  }
  await recordPhasesFromStart(page)
  await page.goto(productPathOf(backendPath, deep))
  await waitForRest(page, deep)

  // The stage starts empty, so there is nothing to cover: the layer never
  // left idle.
  expect(await recordedPhases(page)).toEqual([])
  expect(await switchPhase(page)).toBe('idle')
  await expectRestingAlone(page, deep)
})

test('a navigation while the next product loads retargets the switch, and the load it left is released when it lands', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 3 }))
  expect(afterNext.slug, 'the proof needs three products in a row').not.toBe(start.slug)
  const hold = await holdModelRequests(page, next)
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)

  // The move to the next product reaches the covered stage and its load
  // starts, held on the network.
  await rowControls(page, collection, start).next.click()
  await waitForPhase(page, 'covered')
  await expect
    .poll(() => stageLoads(page), { timeout: testBodyBudgetMs })
    .toMatchObject({ models: [modelUrlOf(next)] })
  expect(hold.requests()).toBeGreaterThan(0)

  // The visitor moves on while it loads: the panel shows the product on the
  // stage, so its next link is the one after.
  await rowControls(page, collection, next).next.click()
  await waitForRest(page, afterNext)

  // One switch, retargeted: one cover and one reveal, never a second
  // sequence stacked on the first, and the left product never presented.
  // Both swaps, to the product left loading and to the newest target,
  // landed on the covered stage.
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next, afterNext])
  for (const snapshot of await recordedSnapshots(page)) {
    expect(snapshot.productSlug === next.slug && snapshot.product === 'ready').toBe(false)
  }
  // The left load is no longer the stage's, and it waits to be released.
  expect(await stageLoads(page)).toMatchObject({ models: [modelUrlOf(afterNext)], settling: 1 })

  // It lands after the newer navigation: it is released then, and the stage
  // still rests on the product it moved to.
  hold.release()
  await expectRestingAlone(page, afterNext)
  expect(await switchPhase(page)).toBe('idle')
  expect(await page.evaluate(() => window.__viewer?.productSlug ?? null)).toBe(afterNext.slug)
})

test('a load that fails during a switch is revealed with the product alert', async ({
  page,
  backendPath,
  expectedBrowserName,
  consoleGate,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.route(`**${modelUrlOf(next)}`, (route) => route.abort())
  // The browser's own line for a failed request exists only in the
  // Chromium builds; the product's failure itself is never a console error.
  if (expectedBrowserName === 'chromium') {
    consoleGate.expectError(/Failed to load resource|net::/, { times: 'one-or-more' })
  }
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)

  await rowControls(page, collection, start).next.click()
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          product: window.__viewer?.product ?? null,
          productSlug: window.__viewer?.productSlug ?? null,
        })),
      { timeout: testBodyBudgetMs },
    )
    .toEqual({ product: 'failed', productSlug: next.slug })
  await waitForPhase(page, 'idle')

  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next])
  await expect(page.getByTestId('product-alert')).toBeVisible()
})

// The band of the real transition, read off the app mid-switch: the band
// rides the stage for the whole switch, so the reading never races a
// phase, and the phase order itself is the sequence proofs' claim. The
// words it rides are the collection's own copy; the red is read from the
// tokens, so a token change is never a test edit.
test('the switch draws the brand ticker band over the stage, in the token red', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)

  await rowControls(page, collection, start).next.click()
  const layer = page.locator('[data-product-transition]')
  const mover = layer.locator('> div > div')
  await expect(mover).toHaveCount(1)
  await expect(mover.locator('span').first()).toBeVisible()
  const drawn = await mover.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(drawn).toBe(await switchBandRed(page))

  await waitForRest(page, next)
  await expectRestingAlone(page, next)
})

// Reduced motion swaps the band for the plain crossfade of the same red,
// through the same phases and the same callback order: the surface draws
// no ticker words.
test('reduced motion runs the same switch on the crossfade, with no ticker words', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)

  await rowControls(page, collection, start).next.click()
  const layer = page.locator('[data-product-transition]')
  const mover = layer.locator('> div > div')
  await expect(mover).toHaveCount(1)
  await expect(mover.locator('span')).toHaveCount(0)
  const drawn = await mover.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(drawn).toBe(await switchBandRed(page))

  await waitForRest(page, next)
  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next])
  await expectRestingAlone(page, next)
})

test('a fast second click during the cover asks for the product it already targets, and one switch runs', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  const requestsOf = await countModelRequests(page)
  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)
  await recordPhases(page)

  // The panel shows the product on stage, so while the cover runs its next
  // link is still this product's: the second click asks the running
  // sequence for the neighbor it already targets, and one switch lands.
  const nextLink = rowControls(page, collection, start).next
  await nextLink.click()
  await nextLink.click()
  await waitForRest(page, next)

  expect(await recordedPhases(page)).toEqual(SWITCH_SEQUENCE)
  await expectSwapsUnderCover(page, [next])
  for (const snapshot of await recordedSnapshots(page)) {
    expect(snapshot.productSlug === afterNext.slug && snapshot.product === 'ready').toBe(false)
  }
  expect(requestsOf(next)).toBe(1)
  await expectRestingAlone(page, next)
})

test('the neighbors are read ahead at rest as bytes only, and the switch takes them over', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  const requestsOf = await countModelRequests(page)
  const neighborUrls = (product: Product) => {
    const neighbors = neighborsOf(collection, product)
    return [...new Set([neighbors.previous, neighbors.next])]
      .filter((neighbor) => neighbor.slug !== product.slug)
      .map(modelUrlOf)
      .sort()
  }
  const readAhead = async () => [...((await stageLoads(page))?.bytes ?? [])].sort()

  await page.goto(productPathOf(backendPath, start))
  await waitForRest(page, start)

  // At rest the stage reads its neighbors' files and parses none of them:
  // the one model load is the product's own.
  await expect.poll(readAhead, { timeout: testBodyBudgetMs }).toEqual(neighborUrls(start))
  expect((await stageLoads(page))?.models).toEqual([modelUrlOf(start)])

  // The switch to a neighbor takes its file over: one read of it in all.
  await rowControls(page, collection, start).next.click()
  await waitForRest(page, next)
  expect(requestsOf(next)).toBe(1)

  // At the next rest the reads ahead follow the new neighbors, never more
  // than two.
  await expect.poll(readAhead, { timeout: testBodyBudgetMs }).toEqual(neighborUrls(next))
  expect((await readAhead()).length).toBeLessThanOrEqual(2)
})
