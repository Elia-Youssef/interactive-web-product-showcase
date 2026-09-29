// E2E layout spec: verifies the responsive layout frame contract at 1440,
// 1024, 768 and 390 px across all matrix projects, plus visual baselines
// for the project configured to host them.

import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'

type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type ViewportContract = {
  readonly width: number
  readonly height: number
  readonly panelWidth:
    { readonly kind: 'fixed'; readonly expected: number } | { readonly kind: 'full' }
  readonly stagePosition: 'right' | 'top'
  readonly stageHeightRatio?: number
  readonly visibleCorners: readonly CornerName[]
  readonly hiddenCorners: readonly CornerName[]
  readonly snapshotName: string
}

const viewportContracts: readonly ViewportContract[] = [
  {
    width: 1440,
    height: 900,
    panelWidth: { kind: 'fixed', expected: 1440 * 0.34 },
    stagePosition: 'right',
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'desktop-layout-1440x900.png',
  },
  {
    width: 1024,
    height: 768,
    panelWidth: { kind: 'fixed', expected: 380 },
    stagePosition: 'right',
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'layout-1024x768.png',
  },
  {
    width: 768,
    height: 1024,
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    stageHeightRatio: 0.6,
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'layout-768x1024.png',
  },
  {
    width: 390,
    height: 844,
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    stageHeightRatio: 0.62,
    visibleCorners: ['top-left', 'top-right', 'bottom-right'],
    hiddenCorners: ['bottom-left'],
    snapshotName: 'layout-390x844.png',
  },
]

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

    if (spec.stageHeightRatio !== undefined) {
      expect(stageBox.height).toBeCloseTo(spec.height * spec.stageHeightRatio, 0)
    }

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

    // 6. Static text corners pass pointer events through to the stage
    if (spec.visibleCorners.includes('bottom-left')) {
      const hint = page.locator('[data-corner="bottom-left"]')
      const hintBox = await hint.boundingBox()
      if (hintBox !== null) {
        const target = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y)
            return {
              slot: el?.getAttribute('data-slot'),
              isHint: el !== null && el.closest('[data-corner="bottom-left"]') !== null,
            }
          },
          { x: hintBox.x + hintBox.width / 2, y: hintBox.y + hintBox.height / 2 },
        )
        expect(target.isHint, 'hint text must pass pointer events through').toBe(false)
        expect(target.slot, 'event at hint center resolves to stage slot').toBe('stage')
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
              slot: el?.getAttribute('data-slot'),
              isLabel: el !== null && el.closest('[data-corner="top-left"]') !== null,
            }
          },
          { x: labelBox.x + labelBox.width / 2, y: labelBox.y + labelBox.height / 2 },
        )
        expect(target.isLabel, 'label text must pass pointer events through').toBe(false)
        expect(target.slot, 'event at label center resolves to stage slot').toBe('stage')
      }
    }
  })
}

for (const spec of viewportContracts) {
  test(`layout visual baseline at ${spec.width}x${spec.height}`, async ({
    page,
    backendPath,
    hostsVisualBaselines,
  }) => {
    test.skip(
      !hostsVisualBaselines,
      'visual baselines are committed for the visual baseline host only',
    )

    await page.setViewportSize({ width: spec.width, height: spec.height })
    await page.goto(backendPath)

    await expect(page).toHaveScreenshot(spec.snapshotName, { fullPage: true })
  })
}
