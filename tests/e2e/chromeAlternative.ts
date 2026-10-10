import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { siteCopy } from '../../src/lib/copy/site'
import { expect } from './fixtures'
import { chromeCollisionsOf } from './hotspotChromeChecks'
import { highlightsButtonOf, itemOf } from './highlightsList'
import { clickCompleted, completedPresentation } from './presentationCompletion'

// An alternative is valid only for an independently projected chrome
// collision, never for an arbitrary missing or unpressable marker.
export async function openChromeAlternative(
  page: Page,
  product: Product,
  hotspot: Product['hotspots'][number],
): Promise<void> {
  expect(
    await chromeCollisionsOf(page, product),
    'the alternative has a complete chrome collision',
  ).toContain(hotspot.id)
  const disclosure = highlightsButtonOf(page, product)
  if ((await disclosure.getAttribute('aria-expanded')) !== 'true') {
    await clickCompleted(page, disclosure)
  }
  const { button, card } = itemOf(page, hotspot.title)
  await clickCompleted(page, button)
  await completedPresentation(page)
  await expect(card.getByRole('heading', { level: 3, name: hotspot.title })).toBeVisible()
  expect(await page.evaluate(() => window.__viewer?.overlay?.card)).toMatchObject({
    selected: hotspot.id,
    slot: 'listed',
    mounted: true,
    shown: true,
  })
  await expect(
    page.getByRole('region', { name: siteCopy.stageLabel }).getByTestId('hotspot-card'),
  ).toHaveCount(0)
}
