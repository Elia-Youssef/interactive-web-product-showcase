import type { Page } from '@playwright/test'
import { resolveProductLook } from '../../src/lib/product'
import { lookDefaults } from '../../src/viewer/look/config'
import { expect, test } from './fixtures'
import { productLoadBudgetMs, restWindowBudgetMs, testBodyBudgetMs } from './budgets'
import { loadCollection } from './productList'
import { expectPoll, harnessPath, waitForProductReady } from './productSpecs'
import { readShadowAuthoredOpacity } from './shadowModelFacts'
import { renderedFramesOf, settledFrames } from './stageSettle'
import { siteCopy } from '../../src/lib/copy/site'

// The stage follow of the exploded view, driven by the panel toggle on the
// app itself: as the pose moves, the baked contact shadow's opacity is the
// authored one scaled by the look and by one minus the applied progress, and
// the backdrop grid's emphasis equals the applied progress. Both are read
// from the real material and the real element styles, and every comparison
// is exact: the facts come from the committed model and the look resolution
// in Node, so a runtime drift of any factor fails.

const product = (await loadCollection()).first
const authoredOpacity = await readShadowAuthoredOpacity(product.slug)
const lookOpacity = resolveProductLook(product.look, lookDefaults).shadowOpacity

const toggleLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

type StageReads = {
  t: number | null
  moving: boolean | null
  opacity: number | null
  // The emphasis input as the section element holds it inline, the exact
  // value the reaction wrote.
  emphasis: string | null
  // The computed emphasis and the alpha tokens the backdrop resolves, with
  // the grid alpha the backdrop applies.
  computedEmphasis: string | null
  restAlpha: number | null
  explodedAlpha: number | null
  gridAlpha: number | null
}

type CompleteStageReads = StageReads & {
  t: number
  opacity: number
  emphasis: string
  restAlpha: number
  explodedAlpha: number
  gridAlpha: number
}

function complete(reads: StageReads): reads is CompleteStageReads {
  return (
    reads.t !== null &&
    reads.opacity !== null &&
    reads.emphasis !== null &&
    reads.restAlpha !== null &&
    reads.explodedAlpha !== null &&
    reads.gridAlpha !== null
  )
}

// One evaluation of every reading the follow contract names, so the pair of
// values each comparison uses comes from one instant of the page.
async function readStage(page: Page): Promise<StageReads> {
  return page.evaluate(() => {
    const section = document.querySelector('[data-slot="stage"]')?.closest('section') ?? null
    const backdrop = document.querySelector('[data-testid="stage-backdrop"]')
    const sectionStyle = section instanceof HTMLElement ? section.style : null
    const sectionComputed = section === null ? null : getComputedStyle(section)
    const backdropComputed = backdrop === null ? null : getComputedStyle(backdrop)
    return {
      t: window.__viewer?.explode?.t ?? null,
      moving: window.__viewer?.explode?.moving ?? null,
      opacity: window.__viewer?.look?.shadow?.opacity ?? null,
      emphasis: sectionStyle?.getPropertyValue('--backdrop-grid-emphasis') ?? null,
      computedEmphasis: sectionComputed?.getPropertyValue('--backdrop-grid-emphasis') ?? null,
      restAlpha: backdropComputed
        ? Number(backdropComputed.getPropertyValue('--backdrop-grid-alpha'))
        : null,
      explodedAlpha: backdropComputed
        ? Number(backdropComputed.getPropertyValue('--backdrop-grid-alpha-exploded'))
        : null,
      gridAlpha: backdropComputed
        ? Number(backdropComputed.getPropertyValue('--backdrop-grid-alpha-applied'))
        : null,
    }
  })
}

async function completeReads(page: Page, at: string): Promise<CompleteStageReads> {
  const reads = await readStage(page)
  if (!complete(reads)) {
    throw new Error(`the stage readings are incomplete ${at}`)
  }
  return reads
}

// The grid alpha the backdrop applies at an emphasis, computed with the same
// double arithmetic as the stylesheet's calc, so the comparison is exact.
function appliedAlpha(reads: CompleteStageReads, emphasis: number): number {
  return reads.restAlpha + emphasis * (reads.explodedAlpha - reads.restAlpha)
}

test('the grid and the shadow are at rest before the view opens', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)

  const reads = await completeReads(page, 'at the assembled rest')

  // The shadow's rest opacity is the composition with no fade, the look
  // factor alone over the authored value.
  expect(reads.opacity).toBe(authoredOpacity * lookOpacity)
  // The grid's emphasis is the rest default, so the applied alpha is the
  // rest token: the stage's pixels at rest are the ones the baselines pin.
  expect(reads.emphasis).toBe('0')
  expect(reads.computedEmphasis).toBe('0')
  expect(reads.gridAlpha).toBe(appliedAlpha(reads, 0))
  expect(reads.gridAlpha).toBe(reads.restAlpha)
})

test('the toggle opens the view onto the exploded grid and no shadow', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)

  await page.getByRole('button', { name: toggleLabel }).click()
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(1)

  const reads = await completeReads(page, 'at the exploded rest')
  expect(reads.moving).toBe(false)

  // The shadow opacity is exactly the composition at a full fade, and the
  // grid emphasis is exactly full, so the applied alpha is the step's far
  // end.
  expect(reads.opacity).toBe(authoredOpacity * lookOpacity * (1 - reads.t))
  expect(reads.emphasis).toBe('1')
  expect(reads.gridAlpha).toBe(appliedAlpha(reads, Number(reads.emphasis)))
  expect(reads.gridAlpha).toBe(reads.explodedAlpha)

  // At rest the loop is stopped: nothing renders across the rest window.
  const atRest = await settledFrames(page)
  await page.waitForTimeout(restWindowBudgetMs)
  expect(await renderedFramesOf(page)).toBe(atRest)
})

test('the toggle closes the view back onto the rest grid and shadow', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)

  await page.getByRole('button', { name: toggleLabel }).click()
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await page.getByRole('button', { name: toggleLabel }).click()
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)

  const reads = await completeReads(page, 'at the closed rest')

  // Both follow the progress back to the exact rest values.
  expect(reads.opacity).toBe(authoredOpacity * lookOpacity)
  expect(reads.emphasis).toBe('0')
  expect(reads.gridAlpha).toBe(appliedAlpha(reads, 0))
  expect(reads.gridAlpha).toBe(reads.restAlpha)
})

test('mid-motion the shadow and the grid follow the applied progress', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)

  await page.getByRole('button', { name: toggleLabel }).click()

  // One evaluation returns the applied progress, the real material opacity
  // and the real emphasis property together, so the sample is consistent.
  // The spring moves for its settle time, so a poll lands inside it; the
  // last sample inside the move is the one the assertions hold.
  const sampled: { reads: CompleteStageReads | null } = { reads: null }
  await expect
    .poll(
      async () => {
        const reads = await readStage(page)
        if (complete(reads) && reads.t > 0 && reads.t < 1) {
          sampled.reads = reads
        }
        return sampled.reads !== null
      },
      { timeout: testBodyBudgetMs },
    )
    .toBe(true)
  const sample = sampled.reads
  if (sample === null) {
    throw new Error('the spring offered no mid-motion sample')
  }

  expect(sample.opacity).toBe(authoredOpacity * lookOpacity * (1 - sample.t))
  expect(sample.emphasis).toBe(String(sample.t))
})

test('under reduced motion the grid and the shadow jump in the toggle frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await waitForExplodeMounted(page)
  const before = await renderedFramesOf(page)

  await page.getByRole('button', { name: toggleLabel }).click()

  // The jump applies the far pose itself and owes exactly the one frame its
  // invalidation presents; the reads after it hold the jumped values.
  await expect
    .poll(() => renderedFramesOf(page), {
      message: 'the toggle must render its one frame',
      timeout: testBodyBudgetMs,
    })
    .toBe(before + 1)

  const reads = await completeReads(page, 'at the jumped rest')
  expect(reads.moving).toBe(false)
  expect(reads.opacity).toBe(authoredOpacity * lookOpacity * (1 - reads.t))
  expect(reads.emphasis).toBe('1')
  expect(reads.gridAlpha).toBe(appliedAlpha(reads, Number(reads.emphasis)))
})

test('remounting the open view from the harness returns the grid and shadow to rest', async ({
  page,
  backendPath,
}) => {
  await page.goto(harnessPath(backendPath, product.slug))
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)

  const explodeToggle = page.getByRole('button', { name: toggleLabel })
  const remount = page.getByTestId('remount-product')

  await explodeToggle.click()
  await expectPoll(page, () => window.__viewer?.explode?.moving, testBodyBudgetMs).toBe(false)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(1)

  // Unmount from the open state: the reaction's release restores its inputs,
  // so the emphasis property is gone from the stage element whatever the
  // progress was.
  await remount.click()
  await expectPoll(page, () => window.__viewer?.product, productLoadBudgetMs).toBe('idle')
  await expectPoll(page, () => window.__viewer?.explode ?? null, testBodyBudgetMs).toBeNull()
  const idle = await readHarnessStage(page)
  expect(idle.emphasis).toBe('')
  expect(idle.computedEmphasis).toBe('0')

  // Remount: presented assembled again, with the shadow at its rest opacity
  // and the grid emphasis back at the rest default.
  await remount.click()
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
  const reads = await readHarnessStage(page)
  expect(reads.opacity).toBe(authoredOpacity * lookOpacity)
  expect(reads.emphasis).toBe('0')
})

// The feature is mounted once the product is presented, so the automation
// reading exists and holds the assembled pose.
async function waitForExplodeMounted(page: Page): Promise<void> {
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null, testBodyBudgetMs).toBe(true)
  await expectPoll(page, () => window.__viewer?.explode?.t, testBodyBudgetMs).toBe(0)
}

// The harness stage element the surface channel writes on, with the
// automation readings, in one evaluation.
async function readHarnessStage(page: Page): Promise<{
  opacity: number | null
  emphasis: string | null
  computedEmphasis: string | null
}> {
  return page.evaluate(() => {
    const frame = document.querySelector('main')
    const frameStyle = frame instanceof HTMLElement ? frame.style : null
    const frameComputed = frame === null ? null : getComputedStyle(frame)
    return {
      opacity: window.__viewer?.look?.shadow?.opacity ?? null,
      emphasis: frameStyle?.getPropertyValue('--backdrop-grid-emphasis') ?? null,
      computedEmphasis: frameComputed?.getPropertyValue('--backdrop-grid-emphasis') ?? null,
    }
  })
}
