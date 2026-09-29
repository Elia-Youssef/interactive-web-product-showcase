// E2E layout spec: verifies the desktop layout frame contract at 1440x900
// and 1024x768 across all matrix projects, plus a visual baseline for chrome-auto.

import { expect, test } from './fixtures'
import { siteCopy } from '../../src/lib/copy/site'

const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
] as const

for (const viewport of desktopViewports) {
  test(`desktop frame contract at ${viewport.width}x${viewport.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(backendPath)

    // 1. The landmarks exist
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

    // 3. The panel width is within the design range at each width
    const panelBox = await panel.boundingBox()
    if (panelBox === null) {
      throw new Error('panel bounding box must be present')
    }
    expect(panelBox.width).toBeGreaterThanOrEqual(380)
    expect(panelBox.width).toBeLessThanOrEqual(520)

    if (viewport.width === 1024) {
      expect(panelBox.width).toBeCloseTo(380, 0)
    }
    if (viewport.width === 1440) {
      expect(panelBox.width).toBeCloseTo(viewport.width * 0.34, 0)
    }

    // 4. The stage fills the rest
    const stageBox = await stage.boundingBox()
    if (stageBox === null) {
      throw new Error('stage bounding box must be present')
    }
    expect(panelBox.width + stageBox.width).toBeCloseTo(viewport.width, 0)
    expect(stageBox.x).toBeCloseTo(panelBox.x + panelBox.width, 0)

    // 5. The four chrome corners sit inside the stage bounds
    const corners = [
      page.locator('[data-corner="top-left"]'),
      page.locator('[data-corner="top-right"]'),
      page.locator('[data-corner="bottom-left"]'),
      page.locator('[data-corner="bottom-right"]'),
    ]

    for (const corner of corners) {
      await expect(corner).toBeAttached()
      const box = await corner.boundingBox()
      if (box === null) {
        throw new Error('corner bounding box must be present')
      }
      expect(box.x).toBeGreaterThanOrEqual(stageBox.x - 0.5)
      expect(box.y).toBeGreaterThanOrEqual(stageBox.y - 0.5)
      expect(box.x + box.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 0.5)
      expect(box.y + box.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 0.5)
    }
  })
}

test('desktop layout visual baseline at 1440x900 on chrome-auto', async ({
  page,
  backendPath,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chrome-auto',
    'visual baseline is committed for chrome-auto only',
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(backendPath)

  await expect(page).toHaveScreenshot('desktop-layout-1440x900.png', { fullPage: true })
})
