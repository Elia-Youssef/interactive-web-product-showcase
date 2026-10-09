// E2E layout spec: verifies the responsive layout frame contract at every
// layout viewport across the layout projects.

import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'
import { productLoadBudgetMs } from './productSpecs'
import { stageBoxOf, viewportContracts } from './layoutContracts'

for (const spec of viewportContracts) {
  test(`responsive frame contract at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(backendPath)

    // 1. The landmarks exist and are visible
    const header = page.getByRole('banner')
    const main = page.getByRole('main')
    const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
    const stage = page.getByRole('region', { name: siteCopy.stageLabel })

    await expect(header).toBeVisible()
    await expect(main).toBeVisible()
    await expect(panel).toBeVisible()
    await expect(stage).toBeVisible()

    // 2. The top bar shows the studio and collection names
    await expect(header.getByText(siteCopy.studioName)).toBeVisible()
    await expect(header.getByText(siteCopy.collectionName)).toBeVisible()

    // 3. Panel width respects the contract for its layout mode
    const panelBox = await panel.boundingBox()
    if (panelBox === null) {
      throw new Error('panel bounding box must be present')
    }

    if (spec.panelWidth.kind === 'fixed') {
      expect(panelBox.width).toBeGreaterThanOrEqual(380 - 0.5)
      expect(panelBox.width).toBeLessThanOrEqual(520 + 0.5)
      expect(panelBox.width).toBeCloseTo(spec.panelWidth.expected, 0)
    } else {
      expect(panelBox.width).toBeCloseTo(spec.width, 0)
    }

    // 4. Stage position relative to the panel
    const stageBox = await stage.boundingBox()
    if (stageBox === null) {
      throw new Error('stage bounding box must be present')
    }

    if (spec.stagePosition === 'right') {
      expect(panelBox.width + stageBox.width).toBeCloseTo(spec.width, 0)
      expect(stageBox.x).toBeCloseTo(panelBox.x + panelBox.width, 0)
    } else {
      expect(stageBox.x).toBeCloseTo(0, 0)
      expect(stageBox.width).toBeCloseTo(spec.width, 0)
      expect(panelBox.x).toBeCloseTo(0, 0)
      expect(panelBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 0.5)
    }

    // The canvas slot is the stage box the hotspot facts are computed for,
    // and its height is the layout tokens' own function of the viewport.
    const slotBox = await page.locator('[data-slot="stage"]').boundingBox()
    if (slotBox === null) {
      throw new Error('the stage slot bounding box must be present')
    }
    const expectedStage = stageBoxOf(spec)
    expect(slotBox.width, 'the stage slot width').toBeCloseTo(expectedStage.width, 0)
    expect(slotBox.height, 'the stage slot height').toBeCloseTo(expectedStage.height, 0)

    // 5. Chrome corners visibility and placement within stage bounds
    for (const cornerKey of spec.visibleCorners) {
      const corner = page.locator(`[data-corner="${cornerKey}"]`)
      await expect(corner).toBeVisible()
      const box = await corner.boundingBox()
      if (box === null) {
        throw new Error(`corner ${cornerKey} bounding box must be present`)
      }
      expect(box.x).toBeGreaterThanOrEqual(stageBox.x - 0.5)
      expect(box.y).toBeGreaterThanOrEqual(stageBox.y - 0.5)
      expect(box.x + box.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 0.5)
      expect(box.y + box.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 0.5)
    }

    for (const cornerKey of spec.hiddenCorners) {
      const corner = page.locator(`[data-corner="${cornerKey}"]`)
      await expect(corner).toBeHidden()
    }

    // 6. Static text corners pass pointer events through to the canvas. The
    // canvas takes its size when the renderer is ready, so the check waits
    // for that: before it there is nothing to drag.
    await expect
      .poll(() => page.evaluate(() => window.__viewer?.status), {
        timeout: productLoadBudgetMs,
      })
      .toBe('ready')
    if (spec.visibleCorners.includes('bottom-left')) {
      const hint = page.locator('[data-corner="bottom-left"]')
      const hintBox = await hint.boundingBox()
      if (hintBox !== null) {
        const target = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y)
            return {
              slot: el?.closest('[data-slot]')?.getAttribute('data-slot'),
              isCanvas: el instanceof HTMLCanvasElement,
              isHint: el !== null && el.closest('[data-corner="bottom-left"]') !== null,
            }
          },
          { x: hintBox.x + hintBox.width / 2, y: hintBox.y + hintBox.height / 2 },
        )
        expect(target.isHint, 'hint text must pass pointer events through').toBe(false)
        expect(target.slot, 'event at hint center resolves to stage slot').toBe('stage')
        expect(target.isCanvas, 'a drag on the hint reaches the canvas').toBe(true)
      }
    }

    if (spec.visibleCorners.includes('top-left')) {
      const label = page.locator('[data-corner="top-left"]')
      const labelBox = await label.boundingBox()
      if (labelBox !== null) {
        const target = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y)
            return {
              slot: el?.closest('[data-slot]')?.getAttribute('data-slot'),
              isCanvas: el instanceof HTMLCanvasElement,
              isLabel: el !== null && el.closest('[data-corner="top-left"]') !== null,
            }
          },
          { x: labelBox.x + labelBox.width / 2, y: labelBox.y + labelBox.height / 2 },
        )
        expect(target.isLabel, 'label text must pass pointer events through').toBe(false)
        expect(target.slot, 'event at label center resolves to stage slot').toBe('stage')
        expect(target.isCanvas, 'a drag on the label reaches the canvas').toBe(true)
      }
    }
  })
}

// The canvas follows the stage slot at every viewport contract: its CSS box
// is the slot's box, and its drawing buffer is that box times the device
// pixel ratio clamped to the stage's [1, 2] window. The clamp bounds are
// stated here, so dropping the clamp fails
// this check on any display above 1x; the one pixel of slack is the
// renderer's integer rounding of the buffer.
for (const spec of viewportContracts) {
  test(`the stage canvas fills its slot at the clamped DPR at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(backendPath)
    await expect
      .poll(() => page.evaluate(() => window.__viewer?.status), {
        timeout: productLoadBudgetMs,
      })
      .toBe('ready')

    const slot = page.locator('[data-slot="stage"]')
    const canvas = page.locator('[data-slot="stage"] canvas')
    const slotBox = await slot.boundingBox()
    const canvasBox = await canvas.boundingBox()
    if (slotBox === null || canvasBox === null) {
      throw new Error('the stage slot and its canvas must have bounding boxes')
    }
    expect(canvasBox.x).toBeCloseTo(slotBox.x, 1)
    expect(canvasBox.y).toBeCloseTo(slotBox.y, 1)
    expect(canvasBox.width).toBeCloseTo(slotBox.width, 1)
    expect(canvasBox.height).toBeCloseTo(slotBox.height, 1)

    const buffer = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (canvas === null) {
        throw new Error('the stage canvas is missing')
      }
      return {
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
      }
    })
    const clampedDpr = Math.min(Math.max(buffer.devicePixelRatio, 1), 2)
    expect(Math.abs(buffer.width - canvasBox.width * clampedDpr)).toBeLessThanOrEqual(1)
    expect(Math.abs(buffer.height - canvasBox.height * clampedDpr)).toBeLessThanOrEqual(1)
  })
}

// Whatever the panel slot holds stays clear of the panel footer and can be
// scrolled into view, at every viewport: the panel is the scroll container,
// and its content never shrinks under the footer.
for (const spec of viewportContracts) {
  test(`panel content stays clear of the footer at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(backendPath)

    const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
    const slotContent = panel.locator('[data-slot="panel"] > *').last()
    const footer = panel.getByText(siteCopy.siteUrl)

    await slotContent.scrollIntoViewIfNeeded()
    await expect(slotContent).toBeInViewport()

    const contentBox = await slotContent.boundingBox()
    const footerBox = await footer.boundingBox()
    if (contentBox === null || footerBox === null) {
      throw new Error('the panel content and footer bounding boxes must be present')
    }
    expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(footerBox.y + 0.5)
  })
}

// The credit line sits in the panel footer, under the domain readout, at
// every viewport. It may wrap on the phone sheet, but its box stays inside
// the panel's own box: no character is clipped at any width.
for (const spec of viewportContracts) {
  test(`the credit line sits under the domain and stays inside the panel at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(backendPath)

    const panel = page.getByRole('complementary', { name: siteCopy.panelLabel })
    const domain = panel.getByText(siteCopy.siteUrl)
    const credit = panel.getByText(siteCopy.credit)

    await expect(credit).toHaveText(siteCopy.credit)
    await credit.scrollIntoViewIfNeeded()
    await expect(credit).toBeVisible()

    const panelBox = await panel.boundingBox()
    const domainBox = await domain.boundingBox()
    const creditBox = await credit.boundingBox()
    if (panelBox === null || domainBox === null || creditBox === null) {
      throw new Error('the panel, domain and credit bounding boxes must be present')
    }
    expect(creditBox.y, 'the credit sits under the domain readout').toBeGreaterThanOrEqual(
      domainBox.y + domainBox.height - 0.5,
    )
    expect(creditBox.x, 'the credit starts inside the panel').toBeGreaterThanOrEqual(
      panelBox.x - 0.5,
    )
    expect(creditBox.x + creditBox.width, 'the credit ends inside the panel').toBeLessThanOrEqual(
      panelBox.x + panelBox.width + 0.5,
    )
    expect(
      creditBox.y + creditBox.height,
      'the credit bottom stays inside the panel',
    ).toBeLessThanOrEqual(panelBox.y + panelBox.height + 0.5)
  })
}
