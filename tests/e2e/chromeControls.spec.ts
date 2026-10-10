import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { referenceLayouts, reflowViewports, type CornerName } from './layoutContracts'
import { waitForProductReady } from './productSpecs'

// The stage chrome's controls, measured in the DOM at every layout size:
// the four corner slots never overlap one another, every control the slots
// hold lies inside the stage box, and the controls pill takes at most two
// rows. The slots take their content's own width, so this holds whatever
// they carry: the rotate row beside the angle, the tilt pair, the zoom
// cluster and Reset, which stay on phones too.

const viewports = [...referenceLayouts, ...reflowViewports]

type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type ChromeMeasure = {
  readonly stage: Box
  // The corner slots on the page now, by name: a corner a breakpoint takes
  // out of the layout (display none) has no box and is absent.
  readonly corners: Partial<Record<CornerName, Box>>
  // Every control of the slots, by its accessible name.
  readonly controls: readonly { readonly name: string; readonly box: Box }[]
  // The distinct row tops of the pill's controls.
  readonly pillRows: number
  readonly expectedPillRows: number
}

async function measureChrome(page: Page): Promise<ChromeMeasure> {
  return page.evaluate((stageLabel) => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    const stage = document.querySelector(`section[aria-label="${stageLabel}"]`)
    if (stage === null) {
      throw new Error('the stage region must be on the page')
    }
    const corners: Record<string, ReturnType<typeof box>> = {}
    for (const corner of stage.querySelectorAll('[data-corner]')) {
      const name = corner.getAttribute('data-corner')
      if (name !== null && getComputedStyle(corner).display !== 'none') {
        corners[name] = box(corner)
      }
    }
    const controls = [...stage.querySelectorAll('[data-corner] button')].map((button) => ({
      name: button.getAttribute('aria-label') ?? button.textContent ?? '',
      box: box(button),
    }))
    // The pill's rows: its controls in reading order of their tops, a new
    // row starting where a control begins below the row it follows ends.
    const pill = [...stage.querySelectorAll('[data-corner="bottom-right"] button')]
      .map(box)
      .sort((a, b) => a.y - b.y)
    let pillRows = 0
    let rowBottom = -Infinity
    for (const control of pill) {
      if (control.y >= rowBottom) {
        pillRows += 1
        rowBottom = control.y + control.height
      } else {
        rowBottom = Math.max(rowBottom, control.y + control.height)
      }
    }
    const pillElement = stage.querySelector('[data-corner="bottom-right"] > div')
    if (pillElement === null) {
      throw new Error('the pill must mount in its chrome slot')
    }
    const style = getComputedStyle(pillElement)
    const stageStyle = getComputedStyle(document.documentElement)
    const inset = Number.parseFloat(stageStyle.getPropertyValue('--inset-stage-chrome'))
    const available = box(stage).width - inset * 2
    // Measure intrinsic content separately: a broken grid can stretch its
    // laid-out rows, which must not change the predicate being tested.
    const intrinsic = pillElement.cloneNode(true)
    if (!(intrinsic instanceof HTMLElement)) throw new Error('the pill clone must be an element')
    intrinsic.style.cssText =
      'display:inline-flex;flex-wrap:nowrap;inline-size:max-content;max-inline-size:none;position:absolute;visibility:hidden;pointer-events:none'
    pillElement.parentElement?.append(intrinsic)
    const groups = [...intrinsic.children].map(box)
    intrinsic.remove()
    const oneRow =
      groups.reduce((width, group) => width + group.width, 0) +
      Number.parseFloat(stageStyle.getPropertyValue('--gap-stage-controls')) +
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth)
    return {
      stage: box(stage),
      corners,
      controls,
      pillRows,
      expectedPillRows: oneRow <= available ? 1 : 2,
    }
  }, siteCopy.stageLabel)
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

for (const viewport of viewports) {
  test(`the stage chrome controls fit the stage at ${viewport.width}x${viewport.height}`, async ({
    page,
    backendPath,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto(backendPath)
    await waitForProductReady(page)
    // The slots fill once the camera is live: the rotate row and the pill
    // carry their controls from then on.
    await expect(page.getByRole('button', { name: siteCopy.rotateRightLabel })).toBeVisible()
    await expect(page.getByRole('button', { name: siteCopy.resetLabel })).toBeVisible()

    const measure = await measureChrome(page)
    await testInfo.attach('chrome-measure', {
      body: JSON.stringify(measure, null, 2),
      contentType: 'application/json',
    })

    const named = Object.entries(measure.corners)
    for (const [index, [name, box]] of named.entries()) {
      for (const [otherName, other] of named.slice(index + 1)) {
        expect(overlaps(box, other), `the ${name} and ${otherName} corners overlap`).toBe(false)
      }
    }
    expect(measure.controls.length, 'the slots carry their controls').toBeGreaterThan(0)
    for (const control of measure.controls) {
      expect(inside(control.box, measure.stage), `${control.name} lies inside the stage`).toBe(true)
    }
    expect(measure.pillRows, 'the controls pill takes at most two rows').toBeLessThanOrEqual(2)
    expect(measure.pillRows, 'the pill wraps only when its content cannot fit one row').toBe(
      measure.expectedPillRows,
    )
  })
}
