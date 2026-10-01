import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { readExplodeModelFacts } from './explodeModelFacts'
import { loadCollection } from './productList'
import { expectPoll, waitForProductReady } from './productSpecs'
import { settledFrames } from './stageSettle'
import { siteCopy } from '../../src/lib/copy/site'

// The exploded view, driven by the panel toggle on the app itself: the
// expected poses come from the committed model's own animation data, read
// in Node, never through the viewer, so the runtime pose is held to the
// file.

const product = (await loadCollection()).first
const facts = await readExplodeModelFacts(product.slug)

const toggleLabel = product.explode.label ?? siteCopy.defaultExplodeLabel

type ExplodeReading = {
  t: number
  target: number
  moving: boolean
  parts: Record<string, { x: number; y: number; z: number }>
}

function renderedFrames(page: Page): Promise<number> {
  return page.evaluate(() => window.__viewer?.renderedFrames ?? -1)
}

test('the toggle opens the exploded view and the stage comes to rest', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)
  const atRest = await settledFrames(page)

  await page.getByRole('button', { name: toggleLabel }).click()

  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expectPoll(page, () => window.__viewer?.explode?.target).toBe(1)

  // The spring moves: frames render while it runs, and the move's frame
  // count is the browser's frame budget, not the spring's. The contract is
  // that the move rendered and the rest that follows renders nothing.
  await expectPoll(page, () => window.__viewer?.explode?.moving).toBe(true)
  await expectPoll(page, () => window.__viewer?.explode?.moving).toBe(false)
  const afterMove = await settledFrames(page)
  expect(afterMove).toBeGreaterThan(atRest)

  // At rest the loop is stopped: nothing renders while the page idles.
  await page.waitForTimeout(2000)
  expect(await renderedFrames(page)).toBe(afterMove)

  // The applied progress is exactly the far end, and every animated PART_
  // node sits exactly at the clip's last keyframe. The progress is asserted
  // first: it is what the pose last applied, so a skipped pose write fails
  // here before the parts can diffuse the cause.
  await expectPoll(page, () => window.__viewer?.explode?.t).toBe(1)
  await expectPose(page, facts.lastPose)
})

test('the toggle closes the view back onto the assembled pose', async ({ page }) => {
  await page.goto('/')
  await waitForExplodeMounted(page)

  await page.getByRole('button', { name: toggleLabel }).click()
  await expectPoll(page, () => window.__viewer?.explode?.moving).toBe(false)
  await page.getByRole('button', { name: toggleLabel }).click()

  await expect(page.getByRole('button', { name: toggleLabel })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expectPoll(page, () => window.__viewer?.explode?.t).toBe(0)
  await expectPoll(page, () => window.__viewer?.explode?.moving).toBe(false)

  const atRest = await settledFrames(page)
  await page.waitForTimeout(2000)
  expect(await renderedFrames(page)).toBe(atRest)

  await expectPose(page, facts.firstPose)
})

test('under reduced motion the toggle jumps to the target in one frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await waitForExplodeMounted(page)
  const before = await renderedFrames(page)

  await page.getByRole('button', { name: toggleLabel }).click()

  // The first frame the toggle owes presents the end state already: no
  // intermediate frame can exist between the click and it.
  await expect
    .poll(() => renderedFrames(page), 'the toggle must render its one frame')
    .toBeGreaterThan(before)
  const reading = await explodeOf(page)
  expect(reading?.t).toBe(1)
  expect(reading?.moving).toBe(false)

  // The jump owes no further frames: the stage is at rest after its one.
  const afterJump = await renderedFrames(page)
  await page.waitForTimeout(1000)
  expect(await renderedFrames(page)).toBe(afterJump)

  await expectPose(page, facts.lastPose)
})

// The feature is mounted once the product is presented, so the automation
// reading exists and holds the assembled pose.
async function waitForExplodeMounted(page: Page): Promise<void> {
  await waitForProductReady(page)
  await expectPoll(page, () => window.__viewer?.explode !== null).toBe(true)
  await expectPoll(page, () => window.__viewer?.explode?.t).toBe(0)
  await settledFrames(page)
}

function explodeOf(page: Page): Promise<ExplodeReading | null> {
  return page.evaluate(() => window.__viewer?.explode ?? null)
}

async function expectPose(
  page: Page,
  pose: Readonly<Record<string, readonly [number, number, number]>>,
): Promise<void> {
  for (const [name, expected] of Object.entries(pose)) {
    const [x, y, z] = expected
    // The part name rides as the evaluate argument: a free variable of the
    // callback is not captured into the page, and `name` there is the
    // window's own empty string. Each part is awaited, so the pose is
    // asserted before the test moves on.
    await expect
      .poll(() => page.evaluate((partName) => window.__viewer?.explode?.parts[partName], name))
      .toEqual({ x, y, z })
  }
}
