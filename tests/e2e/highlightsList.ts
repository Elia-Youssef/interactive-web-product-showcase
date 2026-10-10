import type { Locator, Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import { highlightsLabel } from '../../src/lib/copy/productPanel'
import type { Product } from '../../src/lib/product'
import { expect } from './fixtures'
import { readProductCameraFacts } from './productCamera'
import { cameraAtRest } from './stageKeys'
import { mountedMarkerOf } from './hotspotViews'
import type { CameraRead } from './stageCamera'

// The reads and drives of the Highlights list spec: the panel's section by
// its count, an item and the card under it by the hotspot title, a walk of
// the keyboard to a control, and the subjects each product offers (a
// hotspot with a close-up camera and one without), read from the shipped
// model's own cameras.

export const panelOf = (page: Page): Locator =>
  page.getByRole('complementary', { name: siteCopy.panelLabel })

export const highlightsButtonOf = (page: Page, product: Product): Locator =>
  panelOf(page).getByRole('button', { name: highlightsLabel(product.hotspots.length), exact: true })

// The list item of one hotspot, and its button and card.
export function itemOf(page: Page, title: string) {
  const item = panelOf(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: title, exact: true }) })
  return {
    item,
    button: item.getByRole('button', { name: title, exact: true }),
    card: item.getByTestId('hotspot-card'),
  }
}

// Tabs from where focus rests until the control holds focus, the way a
// keyboard user walks there, within a cap well past the page's stops.
export async function tabTo(page: Page, control: Locator, cap = 60): Promise<void> {
  for (let press = 0; press < cap; press += 1) {
    if (await control.evaluate((element) => element === document.activeElement)) {
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`a plain tab never reached the control within ${cap} presses`)
}

export async function expectFocused(control: Locator, why: string): Promise<void> {
  expect(await control.evaluate((element) => element === document.activeElement), why).toBe(true)
}

export type ListSubjects = {
  // The first hotspot, in manifest order, with a close-up camera, if any.
  readonly closeUp: Product['hotspots'][number] | undefined
  // The first hotspot without one, if any.
  readonly plain: Product['hotspots'][number] | undefined
}

export async function listSubjectsOf(product: Product): Promise<ListSubjects> {
  const facts = await readProductCameraFacts(product.slug)
  return {
    closeUp: product.hotspots.find((hotspot) => facts.closeUps.has(hotspot.id)),
    plain: product.hotspots.find((hotspot) => !facts.closeUps.has(hotspot.id)),
  }
}

// Whether the camera rests where it rested before: no move began.
export function sameOrbit(a: CameraRead, b: CameraRead): boolean {
  return a.azimuth === b.azimuth && a.polar === b.polar && a.distance === b.distance
}

export async function expectCameraStayed(page: Page, before: CameraRead, why: string) {
  expect(sameOrbit(await cameraAtRest(page), before), why).toBe(true)
}

// The first hotspot, in manifest order, whose marker the current view
// hides, or undefined while every marker shows.
export async function hiddenHotspotOf(
  page: Page,
  product: Product,
): Promise<Product['hotspots'][number] | undefined> {
  for (const hotspot of product.hotspots) {
    if (await mountedMarkerOf(page, hotspot.title).isHidden()) {
      return hotspot
    }
  }
  return undefined
}
