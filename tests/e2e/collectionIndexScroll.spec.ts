import { expect } from '@playwright/test'
import { test } from './fixtures'
import { testBudgetMs } from './budgets'
import { siteCopy } from '../../src/lib/copy/site'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import {
  expectScrollOffsetsKept,
  productPathOf,
  rowControls,
  scrollOffsets,
} from './collectionFacts'
import { viewportContracts } from './layoutContracts'

// Opening and closing the index moves nothing behind it: the visitor
// brings the counter into view, wherever the layout keeps it, and every
// scroll offset of the page stays where the visitor put it through the
// open and the close, with focus back on the counter.
const collection = await loadCollection()
const first = collection.first

for (const contract of viewportContracts) {
  test(`opening and closing the index leaves every scroll offset where the visitor put it at ${contract.width}x${contract.height}`, async ({
    page,
    backendPath,
  }) => {
    test.setTimeout(testBudgetMs({ productLoads: 1 }))
    await page.setViewportSize({ width: contract.width, height: contract.height })
    await page.goto(productPathOf(backendPath, first))
    await waitForProductReady(page)

    const { counter } = rowControls(page, collection, first)
    await counter.scrollIntoViewIfNeeded()
    const atRest = await scrollOffsets(page)
    await counter.click()
    const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
    await expect(dialog).toBeVisible()
    expectScrollOffsetsKept(atRest, await scrollOffsets(page))

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(counter).toBeFocused()
    expectScrollOffsetsKept(atRest, await scrollOffsets(page))
  })
}
