import { expect, test } from './fixtures'
import { ambientMotion } from '../../src/lib/motion/ambientMotion'
import { spillsOf } from './reflowFacts'
import { viewportContracts } from './layoutContracts'
import { pinAmbientMotion } from './captureMotion'

// The mark's turn is containment critical twice over: a turned square's
// axis aligned box passes every box it sits in, and the layers that hold
// the turn are decoration that may change no layout box. The spin is
// pinned through the capture seam at the angles of one quarter turn and
// holds the same spill fact the reflow spec holds; the turning layers are
// then taken out of the page through this spec's own seam at every reflow
// size and every header box is held identical, the wrapped phone bar
// included.
for (const [time, angle] of [
  [0, 0],
  [3000, 45],
  [6000, 90],
  [9000, 135],
] as const) {
  test(`the turned mark adds no scrollable overflow at ${angle} degrees of its spin`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(backendPath)
    const mark = page.locator(ambientMotion.selector)
    await expect(mark).toBeVisible()
    await pinAmbientMotion(page, time)
    const spills = await spillsOf(page.locator('header, header *'))
    expect(spills, 'elements whose content spills past their box').toEqual([])
  })
}

// The turning layers are decorative, so they change no layout box: with
// them taken out of the page through this spec's own seam, every box in the
// header stands where it stood with them in, at every reflow size, the
// wrapped phone bar included. The group that hosts the mark also stands
// exactly as tall as the mark slot, its tallest content: the layers
// contribute no box of their own.
for (const contract of viewportContracts) {
  test(`the mark's turning layers change no header box at ${contract.width}x${contract.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(backendPath)
    await page.evaluate(() => document.fonts.ready)
    const mark = page.locator(ambientMotion.selector)
    await expect(mark).toBeVisible()

    const readBoxes = (withTurnLayer: boolean) =>
      page.evaluate((withTurnLayer) => {
        const box = (element: Element) => {
          const r = element.getBoundingClientRect()
          return { top: r.top, left: r.left, width: r.width, height: r.height }
        }
        const header = document.querySelector('header')
        if (header === null) throw new Error('the page holds no header')
        const slot = header.querySelector('[data-slot="mark"]')
        if (slot === null) throw new Error('the header holds no mark slot')
        const left = slot.parentElement
        if (left === null) throw new Error('the mark slot holds no group')
        const name = slot.nextElementSibling
        const right = left.nextElementSibling
        const sweep = slot.querySelector('[data-ra-sweep]')
        return {
          bar: box(header),
          left: box(left),
          slot: box(slot),
          ...(name === null ? {} : { name: box(name) }),
          ...(right === null ? {} : { right: box(right) }),
          ...(withTurnLayer && sweep !== null ? { sweep: box(sweep) } : {}),
        }
      }, withTurnLayer)

    const withLayers = await readBoxes(true)
    expect(
      withLayers.sweep?.width,
      'the sweep renders inline the whole pixel diagonal of the mark',
    ).toBe(46)
    expect(
      withLayers.sweep?.height,
      'the sweep stands exactly the mark tall, so it sits inside the bar wherever the mark does',
    ).toBe(withLayers.slot.height)
    expect(
      withLayers.left.height,
      'the group hosting the mark stands exactly as tall as the mark slot',
    ).toBe(withLayers.slot.height)

    await page.addStyleTag({
      content:
        '[data-motion="ambient"] > *, [data-motion="ambient"]::before { display: none !important; }',
    })
    const withoutLayers = await readBoxes(false)
    const label = `the header boxes at ${contract.width}x${contract.height}`
    expect(withoutLayers.bar, label).toEqual(withLayers.bar)
    expect(withoutLayers.left, `${label}: the mark's group`).toEqual(withLayers.left)
    expect(withoutLayers.slot, `${label}: the mark slot`).toEqual(withLayers.slot)
    expect(withoutLayers.name, `${label}: the studio name`).toEqual(withLayers.name)
    expect(withoutLayers.right, `${label}: the right side`).toEqual(withLayers.right)
  })
}
