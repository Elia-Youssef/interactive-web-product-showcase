import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { expectProduct, productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { viewportContracts } from './layoutContracts'

// A surface of the top layer sits where it declares: a modal dialog is
// centered over its scrim at every layout viewport. The platform centers a
// modal dialog and a popover through an automatic margin, so a global rule
// that zeroes margins moves every such surface into the top-left corner;
// the class proof opens a bare dialog and a bare popover under the app's
// own stylesheets, so a future surface keeps the platform's placement too.
const collection = await loadCollection()

type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// The gap on each side of a box inside the viewport.
async function sideGapsOf(page: Page, box: Box) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  return {
    left: box.x,
    right: viewport.width - (box.x + box.width),
    top: box.y,
    bottom: viewport.height - (box.y + box.height),
  }
}

async function expectCentered(page: Page, box: Box | null, what: string): Promise<void> {
  if (box === null) {
    throw new Error(`${what} must have a box`)
  }
  const gaps = await sideGapsOf(page, box)
  expect(Math.abs(gaps.left - gaps.right), `${what}: left and right gaps`).toBeLessThanOrEqual(1)
  expect(Math.abs(gaps.top - gaps.bottom), `${what}: top and bottom gaps`).toBeLessThanOrEqual(1)
}

for (const contract of viewportContracts) {
  test(`the collection index dialog is centered over its scrim at ${contract.width}x${contract.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(productPathOf(backendPath, collection.first))
    await expectProduct(page, collection.first)

    await page.getByRole('button', { name: siteCopy.openIndexLabel }).dispatchEvent('click')
    const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
    await expect(dialog).toBeVisible()
    await expectCentered(page, await dialog.boundingBox(), 'the index dialog')
  })

  test(`a bare modal dialog keeps the platform's centering at ${contract.width}x${contract.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(backendPath)

    await page.evaluate(() => {
      const dialog = document.createElement('dialog')
      dialog.dataset.placementProbe = 'dialog'
      dialog.textContent = 'Probe'
      document.body.appendChild(dialog)
      dialog.showModal()
    })
    const dialog = page.locator('[data-placement-probe="dialog"]')
    await expect(dialog).toBeVisible()
    await expectCentered(page, await dialog.boundingBox(), 'a bare modal dialog')
  })

  test(`a bare popover keeps the platform's centering at ${contract.width}x${contract.height}`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(backendPath)

    await page.evaluate(() => {
      const popover = document.createElement('div')
      popover.dataset.placementProbe = 'popover'
      popover.popover = 'manual'
      popover.textContent = 'Probe'
      document.body.appendChild(popover)
      popover.showPopover()
    })
    const popover = page.locator('[data-placement-probe="popover"]')
    await expect(popover).toBeVisible()
    await expectCentered(page, await popover.boundingBox(), 'a bare popover')
  })
}
