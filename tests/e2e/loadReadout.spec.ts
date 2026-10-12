import { productModelUrl } from '../../src/lib/product'
import { preloadSlugs } from '../../src/lib/product-switch'
import { stageConfig } from '../../src/viewer/config'
import { expect, test } from './fixtures'
import { loadCollection } from './productList'
import { productLoadBudgetMs, waitForProductReady } from './productSpecs'
import { testBudgetMs } from './budgets'
import { holdDownloads } from './heldDownloads'
import { openIndexAtRest, productPathOf } from './collectionFacts'
import {
  figureOf,
  forgetRecordedReadoutTexts,
  holdRevealDelay,
  recordReadoutReveals,
  recordReadoutTexts,
  recordedReadoutReveals,
  recordedReadoutTexts,
} from './loadReadoutFacts'

// The loading readout, on the app's own pages. The loads are held and
// released through a wrapped fetch, so the readout's own inputs (the bytes
// read and the total they sum to) are driven the way a slow network drives
// them, with the real bytes and the real pipeline behind them. No check
// waits on a clock: the states before the delay are read while the delay is
// held past any run's reach, and the reveal itself is read from the
// animation the page started, never from an opacity sampled at a moment.

const collection = await loadCollection()
const first = collection.first
const heldPaths = [stageConfig.environmentFile, productModelUrl(first.slug)]

// A delay no run can outwait.
const beyondAnyRunMs = 60_000

// The readout's figure right now, or null while it shows none, as a poll
// body that never mistakes no figure for a low one.
async function figureOrBelow(page: Parameters<typeof figureOf>[0]): Promise<number> {
  return (await figureOf(page)) ?? -1
}

test('the held download serves the real bytes through a released stream', async ({
  page,
  backendPath,
}) => {
  const held = await holdDownloads(page, heldPaths)
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)

  const before = await held.state()
  expect(before.every((entry) => entry.delivered === 0)).toBe(true)

  const stepped = await held.release(1)
  expect(stepped.every((entry) => entry.delivered === 1)).toBe(true)
  const ofFirst = before[0]?.of
  if (ofFirst === undefined) {
    throw new Error('the held state named no first download')
  }
  expect(stepped.every((entry) => entry.of === ofFirst)).toBe(true)

  await held.releaseAll()
  await waitForProductReady(page)
})

test('a readout inside its delay is mounted and paints nothing', async ({ page, backendPath }) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await holdRevealDelay(page, beyondAnyRunMs)
  await recordReadoutReveals(page)
  const held = await holdDownloads(page, heldPaths)
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)

  const readout = page.locator('[data-load-readout]')
  await expect.poll(() => readout.count(), { timeout: productLoadBudgetMs }).toBe(1)
  expect(await readout.evaluate((element) => getComputedStyle(element).opacity)).toBe('0')
  await held.release(2)
  await expect.poll(() => figureOrBelow(page), { timeout: productLoadBudgetMs }).toBeGreaterThan(0)
  // Bytes move and still no reveal: the delay holds, and no animation of
  // the readout itself ever started.
  expect(await readout.evaluate((element) => getComputedStyle(element).opacity)).toBe('0')
  expect(await recordedReadoutReveals(page)).toEqual([])

  await held.releaseAll()
  await waitForProductReady(page)
  expect(await page.locator('[data-load-readout]').count()).toBe(0)
})

test('a slow load reveals the readout with a figure that climbs and leaves at ready', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await recordReadoutReveals(page)
  const held = await holdDownloads(page, heldPaths)
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)

  // The figure appears once the slices move, strictly inside the span, and
  // the reveal is the animation the page started, whenever it starts.
  await held.release(2)
  const readout = page.locator('[data-load-readout]')
  await expect
    .poll(() => recordedReadoutReveals(page).then((reveals) => reveals.length), {
      timeout: productLoadBudgetMs,
    })
    .toBeGreaterThan(0)
  await expect.poll(() => figureOrBelow(page), { timeout: productLoadBudgetMs }).toBeGreaterThan(0)
  const opening = await figureOf(page)
  expect(opening).not.toBeNull()
  expect(opening ?? 0).toBeLessThan(100)

  // Sampled across the remaining slices, the figure never falls.
  let previous = opening ?? 0
  for (let slices = 0; slices < 5; slices += 1) {
    await held.release(1)
    await expect
      .poll(() => figureOrBelow(page), { timeout: productLoadBudgetMs })
      .toBeGreaterThanOrEqual(previous)
    previous = (await figureOf(page)) ?? previous
  }
  expect(previous).toBeGreaterThan(opening ?? 0)

  await held.releaseAll()
  await waitForProductReady(page)
  expect(await readout.count()).toBe(0)
})

test('an unknown total shows no figure at any point', async ({ page, backendPath }) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await recordReadoutTexts(page)
  await recordReadoutReveals(page)
  const held = await holdDownloads(page, heldPaths, { contentLength: false })
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)
  await held.release(2)

  const readout = page.locator('[data-load-readout]')
  await expect
    .poll(() => recordedReadoutReveals(page).then((reveals) => reveals.length), {
      timeout: productLoadBudgetMs,
    })
    .toBeGreaterThan(0)
  await expect(readout).toHaveText('Loading')

  for (let slices = 0; slices < 4; slices += 1) {
    await held.release(1)
    await expect(readout).toHaveText('Loading')
  }

  await held.releaseAll()
  await waitForProductReady(page)
  const texts = await recordedReadoutTexts(page)
  expect(texts.length).toBeGreaterThan(0)
  for (const text of texts) {
    expect(text, `the readout held "${text}"`).not.toMatch(/%/)
  }
})

test('after the last byte the readout holds no figure, and never a done one', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await recordReadoutTexts(page)
  const held = await holdDownloads(page, heldPaths)
  await page.goto(backendPath)
  await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)

  await held.release(3)
  await expect.poll(() => figureOrBelow(page), { timeout: productLoadBudgetMs }).toBeGreaterThan(0)
  await held.releaseAll()

  await waitForProductReady(page)
  const texts = await recordedReadoutTexts(page)
  // After the last figure the readout holds exactly the indeterminate word,
  // and then leaves: the ledger's own rule, never a capped number.
  const lastFigureAt = texts.reduce((at, text, index) => (/%$/.test(text) ? index : at), -1)
  expect(
    lastFigureAt,
    `the recorded texts hold no figure: ${JSON.stringify(texts)}`,
  ).toBeGreaterThan(-1)
  expect(texts.slice(lastFigureAt + 1)).toEqual(['Loading', ''])
  for (const text of texts) {
    expect(text, `the readout held "${text}"`).not.toContain('100%')
  }
})

test('a fast load never starts the reveal and ends without the readout', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await holdRevealDelay(page, beyondAnyRunMs)
  await recordReadoutReveals(page)
  await page.goto(backendPath)

  const readout = page.locator('[data-load-readout]')
  await expect.poll(() => readout.count(), { timeout: productLoadBudgetMs }).toBe(1)
  // Still inside the delay: nothing painted, and the reveal itself never
  // started. A delayed animation exists before it starts; its start is the
  // recorded event below, never fired.
  expect(await readout.evaluate((element) => getComputedStyle(element).opacity)).toBe('0')

  await waitForProductReady(page)
  expect(await recordedReadoutReveals(page)).toEqual([])
  expect(await readout.count()).toBe(0)
  expect(await page.locator('[data-live-announcement]').textContent()).toBe('')
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('keeps the delay, steps the fill, rests the segment and still reveals', async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 1 }))
    const held = await holdDownloads(page, heldPaths)
    await page.goto(backendPath)
    await expect.poll(() => held.allHeld(), { timeout: productLoadBudgetMs }).toBe(true)

    // The delay is the token's own, not resolved away by the motion scale.
    const readout = page.locator('[data-load-readout]')
    await expect.poll(() => readout.count(), { timeout: productLoadBudgetMs }).toBe(1)
    await expect
      .poll(
        () =>
          readout.evaluate((element) => {
            const delay = getComputedStyle(element).animationDelay
            return delay.endsWith('ms') ? Number.parseFloat(delay) : Number.parseFloat(delay) * 1000
          }),
        { timeout: productLoadBudgetMs },
      )
      .toBe(800)

    // While the figure is unknown the track holds the marching segment, and
    // under reduced motion it is none.
    const inner = readout.locator('span span')
    await expect(inner).toHaveCount(1)
    await expect
      .poll(() => inner.evaluate((element) => getComputedStyle(element).animationName), {
        timeout: productLoadBudgetMs,
      })
      .toBe('none')

    // The fill's ease resolves to instant: the track steps.
    await held.release(2)
    await expect
      .poll(() => inner.evaluate((element) => getComputedStyle(element).transitionDuration), {
        timeout: productLoadBudgetMs,
      })
      .toBe('0s')

    // The reveal still speaks: the region holds the loading word, and the
    // ended wait clears it.
    const region = page.locator('[data-live-announcement]')
    await expect.poll(() => region.textContent(), { timeout: productLoadBudgetMs }).toBe('Loading')

    await held.releaseAll()
    await waitForProductReady(page)
    expect(await readout.count()).toBe(0)
    await expect(region).toHaveText('')
  })
})

test('a held switch to a product that is not read ahead never shows the readout', async ({
  page,
  backendPath,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 2 }))
  // The read ahead covers the first product's own neighbors, so the switch
  // this test holds rides through the collection index instead.
  const readAhead = new Set(preloadSlugs(first.slug, collection))
  const target = collection.products.find(
    (product) => product.slug !== first.slug && !readAhead.has(product.slug),
  )
  if (target === undefined) {
    throw new Error('every other product is read ahead; pick a switch this test cannot hold')
  }

  await recordReadoutTexts(page)
  const held = await holdDownloads(page, [productModelUrl(target.slug)])
  await page.goto(productPathOf(backendPath, first))
  await waitForProductReady(page)
  // The first load showed its readout; the switch below must not.
  await forgetRecordedReadoutTexts(page)

  const index = await openIndexAtRest(page)
  await index.getByRole('link', { name: new RegExp(target.model) }).click()
  // The switch covers, swaps under the cover, and the held download keeps
  // it covered: the band is the affordance there, the readout stays out.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const layer = document.querySelector('[data-product-transition]')
          return {
            phase: layer?.getAttribute('data-product-transition') ?? null,
            shown: layer?.getAttribute('data-product-shown') ?? null,
          }
        }),
      { timeout: productLoadBudgetMs },
    )
    .toEqual({ phase: 'covered', shown: target.slug })
  expect(await page.locator('[data-load-readout]').count()).toBe(0)

  await held.releaseAll()
  await waitForProductReady(page)
  expect(await page.locator('[data-load-readout]').count()).toBe(0)
  // Through the whole held switch, the readout never entered the DOM.
  expect(await recordedReadoutTexts(page)).toEqual([])
})
