// E2E product transition spec: the ticker band on the gallery page, driven
// through the section's phase stepper. It proves the contract's visible
// claims: nothing drawn at idle, the band covering the stage box fully at
// covered, both callbacks arriving exactly once and in order from the real
// animation ends, the reduced-motion crossfade paying the same callbacks,
// and the whole surface staying inside the stage box with nothing
// focusable in it. The gallery drives the reduced-motion prop directly, so
// the crossfade runs at the full token pace and its animation is observable.

import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { restWindowBudgetMs, transitionMoveBudgetMs } from './budgets'
import { switchBandRed } from './switchBandRed'

const GALLERY_PATH = '/gallery.html'
const STAGE_SELECTOR = '[data-transition-stage]'
// The transition surface, and the moving element inside it: the band in
// full motion, the fade under reduced motion.
const ROOT_SELECTOR = '[data-transition-slot] > div'
const MOVER_SELECTOR = `${ROOT_SELECTOR} > div`
const MOVE_SLOWED = '3000ms'
/*
The mid-flight sample of the slowed move: a third of the way through, at
1s of the 3s the slowed cover runs. The eased move has then covered about
70% of its travel, which leaves the stage's top-left corner, the far end
of its bottom-right to top-left sweep, outside the band by about a third
of the stage height, and leaves the whole second half of the move for the
poll that waits for the real end.
*/
const MID_FLIGHT_SAMPLE_MS = 1_000

function phaseButton(page: Page, label: string) {
  return page.getByRole('button', { name: label, exact: true })
}

async function firedCallbacks(page: Page): Promise<string[]> {
  return page
    .getByRole('list', { name: 'Fired transition callbacks' })
    .locator('li')
    .allTextContents()
}

// The stage box, and whether each of its probe points sits inside the
// tilted mover. The mover reads its untransformed layout size and its own
// rotation from the computed matrix, so the check is the real geometry of
// the rotated rectangle, not of its axis-aligned bounding box.
function coverage(page: Page): Promise<readonly { name: string; inside: boolean }[]> {
  return page.evaluate(
    ({ stageSelector, moverSelector }) => {
      const stage = document.querySelector(stageSelector)
      const mover = document.querySelector(moverSelector)
      if (stage === null || mover === null) {
        throw new Error('the transition stage or its mover is missing')
      }
      if (!(mover instanceof HTMLElement)) {
        throw new Error('the transition mover must be an element with layout')
      }
      const stageBox = stage.getBoundingClientRect()
      const moverBox = mover.getBoundingClientRect()
      const moverWidth = mover.offsetWidth
      const moverHeight = mover.offsetHeight
      const transform = getComputedStyle(mover).transform
      const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform)
      const angle = Math.atan2(matrix.b, matrix.a)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const centerX = moverBox.x + moverBox.width / 2
      const centerY = moverBox.y + moverBox.height / 2
      const probes: readonly (readonly [string, number, number])[] = [
        ['top-left', 0, 0],
        ['top-right', stageBox.width, 0],
        ['bottom-left', 0, stageBox.height],
        ['bottom-right', stageBox.width, stageBox.height],
        ['top', stageBox.width / 2, 0],
        ['bottom', stageBox.width / 2, stageBox.height],
        ['left', 0, stageBox.height / 2],
        ['right', stageBox.width, stageBox.height / 2],
        ['center', stageBox.width / 2, stageBox.height / 2],
      ]
      return probes.map(([name, px, py]) => {
        const dx = stageBox.x + px - centerX
        const dy = stageBox.y + py - centerY
        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos
        return {
          name,
          inside: Math.abs(localX) <= moverWidth / 2 && Math.abs(localY) <= moverHeight / 2,
        }
      })
    },
    { stageSelector: STAGE_SELECTOR, moverSelector: MOVER_SELECTOR },
  )
}

test('the transition draws nothing while idle', async ({ page }) => {
  await page.goto(GALLERY_PATH)

  await expect(page.locator(ROOT_SELECTOR)).toHaveCount(0)
  expect(await firedCallbacks(page)).toEqual([])
})

test('the band covers the stage fully at covered, inside the stage box', async ({ page }) => {
  await page.goto(GALLERY_PATH)

  await phaseButton(page, 'Covering').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered'])
  await phaseButton(page, 'Covered').click()

  // The surface is exactly the stage box: the panel and the top bar stay
  // out of reach by construction.
  const stageBox = await page.locator(STAGE_SELECTOR).boundingBox()
  const rootBox = await page.locator(ROOT_SELECTOR).boundingBox()
  expect(stageBox).not.toBeNull()
  expect(rootBox).not.toBeNull()
  if (stageBox === null || rootBox === null) {
    throw new Error('the stage and transition boxes must be present')
  }
  expect(rootBox.x).toBeCloseTo(stageBox.x, 0)
  expect(rootBox.y).toBeCloseTo(stageBox.y, 0)
  expect(rootBox.width).toBeCloseTo(stageBox.width, 0)
  expect(rootBox.height).toBeCloseTo(stageBox.height, 0)

  // Every probe point of the stage sits inside the tilted band.
  const covered = await coverage(page)
  for (const point of covered) {
    expect(point.inside, `${point.name} of the stage must be covered`).toBe(true)
  }

  // The surface never takes a pointer event, so the stage under it keeps
  // every drag: the hit test at the center skips the transition entirely.
  const hit = await page.evaluate(
    ({ stageSelector }) => {
      const stage = document.querySelector(stageSelector)
      if (stage === null) {
        throw new Error('the transition stage is missing')
      }
      const box = stage.getBoundingClientRect()
      const at = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return at?.closest('[data-transition-slot]') !== null
    },
    { stageSelector: STAGE_SELECTOR },
  )
  expect(hit, 'the covered band must not take the hit test').toBe(false)

  // Decorative: nothing inside the surface takes focus.
  await expect(page.locator(ROOT_SELECTOR)).toHaveAttribute('aria-hidden', 'true')
  await expect(
    page.locator(
      `${ROOT_SELECTOR} button, ${ROOT_SELECTOR} a, ${ROOT_SELECTOR} input, ${ROOT_SELECTOR} [tabindex]`,
    ),
  ).toHaveCount(0)
})

test('the callbacks arrive once each, in order, over a whole switch', async ({ page }) => {
  await page.goto(GALLERY_PATH)

  await phaseButton(page, 'Covering').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered'])
  await phaseButton(page, 'Covered').click()
  await phaseButton(page, 'Revealing').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered', 'revealed'])

  // Nothing further fires once both debts are paid: the log stays exactly
  // these two entries, waited through the suite's own rest window.
  await page.waitForTimeout(restWindowBudgetMs)
  expect(await firedCallbacks(page)).toEqual(['covered', 'revealed'])
})

test('a phase left mid-motion fires no callback for it', async ({ page }) => {
  await page.goto(GALLERY_PATH)
  await page
    .locator(STAGE_SELECTOR)
    .evaluate(
      (stage, slowed) => stage.style.setProperty('--duration-switch-move', slowed),
      MOVE_SLOWED,
    )

  await phaseButton(page, 'Covering').click()
  await phaseButton(page, 'Revealing').click()

  // The cover was abandoned well before its end, so covered never fires;
  // the reveal runs its full course and pays revealed alone.
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['revealed'])
})

test('reduced motion gives a crossfade and pays the same callbacks', async ({ page }) => {
  await page.goto(GALLERY_PATH)
  await page.getByRole('checkbox', { name: 'Reduced motion' }).check()

  await phaseButton(page, 'Covering').click()

  // The crossfade is the red without the band: no moving children, no
  // ticker text, the fade animation itself on the surface.
  const mover = page.locator(MOVER_SELECTOR)
  await expect(mover).toHaveCount(1)
  await expect(mover.locator('div')).toHaveCount(0)
  await expect(mover).toHaveText('')
  const fade = await mover.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animation: style.animationName,
      background: style.backgroundColor,
    }
  })
  expect(fade.animation).not.toBe('none')
  // The crossfade paints the band's own color token, read as the browser
  // resolves it, so the value follows the tokens.
  expect(fade.background).toBe(await switchBandRed(page))
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered'])

  await phaseButton(page, 'Covered').click()
  await phaseButton(page, 'Revealing').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered', 'revealed'])
})

test('the instant reduced form still pays both callbacks in order', async ({ page }) => {
  await page.goto(GALLERY_PATH)
  // The real app drives the prop from this media query, so the durations
  // resolve to zero and every motion end is instant. The end event still
  // carries the callback, in the same order.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('checkbox', { name: 'Reduced motion' }).check()

  await phaseButton(page, 'Covering').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered'])
  await phaseButton(page, 'Covered').click()
  await phaseButton(page, 'Revealing').click()
  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered', 'revealed'])
})

test('the covered callback waits for the slowed animation end', async ({ page }) => {
  await page.goto(GALLERY_PATH)
  await page
    .locator(STAGE_SELECTOR)
    .evaluate(
      (stage, slowed) => stage.style.setProperty('--duration-switch-move', slowed),
      MOVE_SLOWED,
    )

  await phaseButton(page, 'Covering').click()
  /*
  A third of the way through the slowed move, the callback has not fired
  and the band has not reached the stage's top-left corner yet: the eased
  move enters from the bottom-right, and at a third of its run its near
  edge still passes about a third of the stage height short of that
  corner. The debt is paid by the animation's end, not by any guess at it.
  */
  await page.waitForTimeout(MID_FLIGHT_SAMPLE_MS)
  expect(await firedCallbacks(page)).toEqual([])
  const midFlight = await coverage(page)
  const topLeft = midFlight.find((point) => point.name === 'top-left')
  expect(topLeft, 'the probe points carry the top-left corner').toBeDefined()
  expect(topLeft?.inside, 'the top-left corner must still be uncovered mid-flight').toBe(false)

  await expect
    .poll(() => firedCallbacks(page), { timeout: transitionMoveBudgetMs })
    .toEqual(['covered'])
})
