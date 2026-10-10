import { expect, test } from './fixtures'
import { ambientMotion } from '../../src/lib/motion/ambientMotion'
import { siteIcons } from '../../scripts/faviconHead.ts'
import { loadCollection } from './productList'
import { productPathOf } from './collectionFacts'
import { testBodyBudgetMs, testBudgetMs } from './budgets'
import { waitForProductReady } from './productSpecs'

const collection = await loadCollection()

test('the index and every product page show the decorative mark and serve all favicon links', async ({
  page,
  backendPath,
  request,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: collection.products.length + 1 }))
  const paths = [
    backendPath,
    ...collection.products.map((product) => productPathOf(backendPath, product)),
  ]
  for (const path of paths) {
    await page.goto(path)
    await waitForProductReady(page)
    const mark = page.locator(`[data-slot="mark"] ${ambientMotion.selector}`)
    await expect(mark).toBeVisible()
    await expect(mark).toHaveAttribute('aria-hidden', 'true')
    await expect(mark).not.toHaveAttribute('tabindex')
    expect(await mark.evaluate((element) => element.getBoundingClientRect().width)).toBe(32)
    for (const icon of siteIcons) {
      const link = page.locator(`link[rel="${icon.rel}"][type="${icon.type}"]`)
      await expect(link).toHaveAttribute('href', `/${icon.file}`)
      expect((await request.get(`/${icon.file}`)).status()).toBe(200)
    }
  }
})

test('two ambient animations rotate both rings together while the sweep remains in page space', async ({
  page,
  backendPath,
}) => {
  await page.goto(backendPath)
  const mark = page.locator(ambientMotion.selector)
  await expect(mark).toBeVisible()
  const running = await mark.evaluate((element) =>
    element.getAnimations({ subtree: true }).map((animation) => ({
      state: animation.playState,
      duration: animation.effect?.getTiming().duration,
      iterations: animation.effect?.getTiming().iterations,
    })),
  )
  expect(running).toEqual([
    { state: 'running', duration: 24000, iterations: Infinity },
    { state: 'running', duration: 12000, iterations: Infinity },
  ])
  for (const [time, start, end, rotation] of [
    [0, '0deg', '0deg', '0deg'],
    [3000, '0deg', '180deg', '45deg'],
    [6000, '0deg', '360deg', '90deg'],
    [9000, '180deg', '360deg', '135deg'],
  ] as const) {
    const frame = await mark.evaluate((element, time) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = time
      }
      const sweep = element.querySelector('[data-ra-sweep]')
      if (sweep === null) throw new Error('missing sweep')
      const style = getComputedStyle(sweep)
      return {
        start: style.getPropertyValue('--ra-sweep-start').trim(),
        end: style.getPropertyValue('--ra-sweep-end').trim(),
        rotation: getComputedStyle(element).getPropertyValue('--ra-spin-angle').trim(),
        transforms: Array.from(
          element.querySelectorAll('[data-ra-ring]'),
          (ring) => getComputedStyle(ring).transform,
        ),
        sweepTransform: style.transform,
      }
    }, time)
    expect(frame.start).toBe(start)
    expect(frame.end).toBe(end)
    expect(frame.rotation).toBe(rotation)
    expect(frame.transforms[0]).toBe(frame.transforms[1])
    expect(frame.sweepTransform).toBe('none')
  }
})

test('reduced motion shows the white rest frame with no animation and an instant hover transition', async ({
  page,
  backendPath,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(backendPath)
  const mark = page.locator(ambientMotion.selector)
  await expect(mark).toBeVisible()
  expect(await mark.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  expect(
    await mark.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--ra-spin-angle').trim(),
    ),
  ).toBe('0deg')
  const sweep = mark.locator('[data-ra-sweep]')
  expect(
    await sweep.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--ra-sweep-end').trim(),
    ),
  ).toBe('0deg')
  expect(
    await mark.locator('svg').evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s')
})

test('only the glyph glows under a hovering pointer', async ({ page, backendPath }) => {
  await page.goto(backendPath)
  const mark = page.locator(ambientMotion.selector)
  await expect(mark).toBeVisible()
  const box = await mark.boundingBox()
  if (box === null) throw new Error('the mark has no box')
  const glyph = mark.locator('svg')
  const expectedFilter = await mark.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.filter =
      'drop-shadow(0 0 calc(var(--size-ra-mark) * var(--ra-hover-glow-near-ratio)) rgb(var(--red-rgb) / var(--ra-hover-alpha-near))) drop-shadow(0 0 calc(var(--size-ra-mark) * var(--ra-hover-glow-far-ratio)) rgb(var(--red-rgb) / var(--ra-hover-alpha-far)))'
    element.append(probe)
    const filter = getComputedStyle(probe).filter
    probe.remove()
    return filter
  })
  expect(expectedFilter).not.toBe('none')
  await page.mouse.move(
    Math.round(box.x + (box.width * 500) / 1080),
    Math.round(box.y + (box.height * 560) / 1080),
  )
  await expect
    .poll(() => glyph.evaluate((element) => getComputedStyle(element).filter), {
      timeout: testBodyBudgetMs,
    })
    .toBe(expectedFilter)
  await page.mouse.move(box.x + box.width / 2, box.y + 1)
  await expect
    .poll(() => glyph.evaluate((element) => getComputedStyle(element).filter), {
      timeout: testBodyBudgetMs,
    })
    .toBe('none')
})

test.describe('touch pointers', () => {
  test.use({ hasTouch: true })
  test('a touch on the glyph leaves no hover glow', async ({ page, backendPath }) => {
    await page.goto(backendPath)
    const mark = page.locator(ambientMotion.selector)
    await expect(mark).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false)
    const box = await mark.boundingBox()
    if (box === null) throw new Error('the mark has no box')
    await page.touchscreen.tap(
      Math.round(box.x + (box.width * 500) / 1080),
      Math.round(box.y + (box.height * 560) / 1080),
    )
    expect(await mark.locator('svg').evaluate((element) => getComputedStyle(element).filter)).toBe(
      'none',
    )
  })
})

test('glow radii scale with the mark box at a larger size', async ({ page, backendPath }) => {
  await page.goto(backendPath)
  const mark = page.locator(ambientMotion.selector)
  await expect(mark).toBeVisible()
  const expected = await mark.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('the mark must have a style')
    element.style.setProperty('--size-ra-mark', '64px')
    const probe = document.createElement('span')
    probe.style.filter =
      'drop-shadow(0 0 4px rgb(var(--red-rgb) / var(--ra-sweep-alpha-near))) drop-shadow(0 0 12px rgb(var(--red-rgb) / var(--ra-sweep-alpha-far)))'
    element.append(probe)
    const sweep = getComputedStyle(probe).filter
    probe.style.filter =
      'drop-shadow(0 0 6px rgb(var(--red-rgb) / var(--ra-hover-alpha-near))) drop-shadow(0 0 16px rgb(var(--red-rgb) / var(--ra-hover-alpha-far)))'
    const hover = getComputedStyle(probe).filter
    probe.remove()
    return { sweep, hover }
  })
  const glow = mark.locator('[data-ra-sweep]').locator('..')
  expect(await glow.evaluate((element) => getComputedStyle(element).filter)).toBe(expected.sweep)
  const box = await mark.boundingBox()
  if (box === null) throw new Error('the mark has no box')
  await page.mouse.move(
    Math.round(box.x + (box.width * 500) / 1080),
    Math.round(box.y + (box.height * 560) / 1080),
  )
  await expect
    .poll(() => mark.locator('svg').evaluate((element) => getComputedStyle(element).filter), {
      timeout: testBodyBudgetMs,
    })
    .toBe(expected.hover)
})
