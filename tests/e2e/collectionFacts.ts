import { requireHotspotProducts } from './hotspotProducts'
import { expect, type Locator, type Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import type { Product, ProductCollection } from '../../src/lib/product'
import { formatProductPath } from '../../src/lib/routing'
import { stepLabel } from '../../src/lib/product'
import { routePath } from './appPaths'
import { productLoadBudgetMs } from './budgets'
import type { BrowserName } from './matrix'
import { waitForProductReady } from './productSpecs'
import { markerOf } from './hotspotViews'
import { clickCompleted, completedPresentation } from './presentationCompletion'

// The reads and expectations of the collection spec: the collection's own
// neighbors, the row's controls by accessible name, the wait for a
// product the page presents, the stops of the open index's tab cycle, and
// the engines' keyboard model over links.

// The keyboard model of the engines over links, as this Playwright build
// ships it and the link tabbing spec pins on the app itself: a plain tab
// reaches links on chromium and firefox, while the webkit build follows
// the macOS keyboard model, where a plain tab moves between form controls
// only and no modified tab reaches links (an alt tabbed walk tabs the same
// link-free order). The links stay reachable there through the platform's
// full keyboard access mode, outside what a keyboard walk of this suite
// can drive.
export function plainTabReachesLinks(browserName: BrowserName): boolean {
  return browserName !== 'webkit'
}

// The path and query of an absolute page URL, the form the href attributes
// and the app's own navigation spell.
export function urlPath(url: string): string {
  const parsed = new URL(url)
  return parsed.pathname + parsed.search
}

// The collection's neighbor of one product, or the loud error it is when
// the slug is not the collection's own.
export function neighborsOf(collection: ProductCollection, product: Product) {
  const neighbors = collection.neighbors(product.slug)
  if (neighbors === undefined) {
    throw new Error(`the collection holds no product '${product.slug}'`)
  }
  return neighbors
}

// The row's controls of one product, located by their accessible names.
export function rowControls(page: Page, collection: ProductCollection, product: Product) {
  const neighbors = neighborsOf(collection, product)
  return {
    counter: page.getByRole('button', { name: siteCopy.openIndexLabel }),
    previous: page.getByRole('link', {
      name: stepLabel(siteCopy.previousLabel, neighbors.previous),
    }),
    next: page.getByRole('link', { name: stepLabel(siteCopy.nextLabel, neighbors.next) }),
    neighbors,
  }
}

// The page presents the product: the automation hook names it and the
// product is on a recorded frame.
export async function expectProduct(page: Page, product: Product): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.productSlug ?? null), {
      timeout: productLoadBudgetMs,
    })
    .toBe(product.slug)
  await waitForProductReady(page)
}

// The app path of a product, with the backend mode's query on it.
export function productPathOf(backendPath: string, product: Product): string {
  return routePath(backendPath, formatProductPath(product.slug))
}

// One focus location of the open index's tab cycle: the element focus
// rests on, or the body rest the platform makes between cycles.
export type DialogStop = {
  readonly onBody: boolean
  readonly tag: string
  readonly name: string
}

function stopOf(page: Page): Promise<DialogStop> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (element === null) {
      return { onBody: false, tag: 'NONE', name: '' }
    }
    if (element === document.body) {
      return { onBody: true, tag: 'BODY', name: '' }
    }
    return {
      onBody: false,
      tag: element.tagName,
      name: element.getAttribute('aria-label') ?? (element.textContent ?? '').slice(0, 60),
    }
  })
}

function stopsMatch(one: DialogStop, other: DialogStop): boolean {
  return one.onBody === other.onBody && one.tag === other.tag && one.name === other.name
}

// Walks the open index's tab cycle once and returns every distinct stop it
// rests on, the body rest included: the set of focus locations Escape
// must behave identically at.
export async function dialogTabStops(page: Page): Promise<readonly DialogStop[]> {
  const stops: DialogStop[] = []
  for (let tabs = 0; tabs < 12; tabs++) {
    const stop = await stopOf(page)
    if (stops.some((known) => stopsMatch(known, stop))) {
      return stops
    }
    stops.push(stop)
    await page.keyboard.press('Tab')
  }
  throw new Error('the tab cycle never returned to its first stop')
}

// Tabs the open index around its cycle until focus rests on the stop.
export async function walkToDialogStop(page: Page, stop: DialogStop): Promise<void> {
  for (let tabs = 0; tabs < 12; tabs++) {
    if (stopsMatch(await stopOf(page), stop)) {
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error('the tab cycle never rested on the stop again')
}

// The first product of the collection that carries hotspots, the subject
// of the specs that drive a card, or the loud error it is when none does.
export function productWithHotspots(collection: ProductCollection): Product {
  return requireHotspotProducts(collection.products, 'collection card proof')[0]
}

// Opens the card of the first hotspot whose marker is shown at the home
// view and returns its title once the card has landed. A marker the view
// hides leaves the role tree, so the role query finds a shown one only.
export async function openShownCard(page: Page, product: Product): Promise<string> {
  for (const candidate of product.hotspots) {
    const marker = markerOf(page, candidate.title)
    if (await marker.isVisible()) {
      await openCardWith(page, marker)
      return candidate.title
    }
  }
  throw new Error(`no marker of '${product.slug}' is shown at the home view`)
}

// Presses a marker and waits for its card to land: a card that docks
// brings itself into view through the panel's smooth scroll, and a press
// on another panel control while that scroll still runs can go down on the
// control and come up past it, so no click lands. The native scroll and
// presented camera complete before the caller can act on another control.
export async function openCardWith(page: Page, marker: Locator): Promise<void> {
  await clickCompleted(page, marker)
  await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
  await completedPresentation(page)
}

export async function scrollsAtRest(page: Page): Promise<void> {
  await completedPresentation(page)
}

// The accessible name of the element focus rests on: its aria-label, its
// text, or its tag when it carries neither.
export function focusedAccessibleName(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (element === null) {
      return null
    }
    return element.getAttribute('aria-label') ?? element.textContent ?? element.tagName
  })
}

// Presses the tab across the open modal dialog and expects every stop to
// stay off the page's content: inside the dialog, or on the body rest the
// platform makes between cycles. The containment is the platform's own,
// with no hand-written trap.
export async function expectTabHeldInsideDialog(page: Page): Promise<void> {
  for (let tabs = 0; tabs < 8; tabs++) {
    await page.keyboard.press('Tab')
    const stoppedAt = await page.evaluate(() => {
      const element = document.activeElement
      if (element === null) {
        return 'null'
      }
      return element.closest('dialog') !== null || element === document.body
        ? 'held'
        : `${element.tagName} ${element.getAttribute('aria-label') ?? ''}`
    })
    expect(stoppedAt, 'the tab must never land outside the open dialog').toBe('held')
  }
}

// The scroll offsets of the page: the document's own and every element's
// that scrolls, keyed by a probe mark the first read sets on each, so a
// later read compares the same scrollers. A capture or a check that must
// show the page as the visitor left it compares two reads.
export type ScrollOffsets = Readonly<Record<string, readonly [number, number]>>

export function scrollOffsets(page: Page): Promise<ScrollOffsets> {
  return page.evaluate(() => {
    const offsets: Record<string, [number, number]> = {}
    const scrollers = [
      document.scrollingElement ?? document.documentElement,
      ...Array.from(document.querySelectorAll('*')).filter((element) => {
        const style = getComputedStyle(element)
        const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll'
        return scrolls(style.overflowY) || scrolls(style.overflowX)
      }),
    ]
    let next = document.querySelectorAll('[data-scroll-probe]').length
    for (const element of scrollers) {
      if (!(element instanceof HTMLElement)) {
        continue
      }
      if (element.dataset.scrollProbe === undefined) {
        element.dataset.scrollProbe = String(next)
        next += 1
      }
      offsets[element.dataset.scrollProbe] = [element.scrollTop, element.scrollLeft]
    }
    return offsets
  })
}

// Every scroller read before stays where it was.
export function expectScrollOffsetsKept(before: ScrollOffsets, after: ScrollOffsets): void {
  for (const [scroller, offset] of Object.entries(before)) {
    expect(after[scroller], `the scroll offset of scroller ${scroller}`).toEqual(offset)
  }
}

// Opens the collection index from the counter without moving the page: the
// press is dispatched to the counter where it sits, with no scroll into
// view first, so the open dialog sits over the page at rest, whatever the
// viewport. The page's scroll offsets are pinned across the open.
export async function openIndexAtRest(page: Page): Promise<Locator> {
  const before = await scrollOffsets(page)
  await page.getByRole('button', { name: siteCopy.openIndexLabel }).dispatchEvent('click')
  const dialog = page.getByRole('dialog', { name: siteCopy.indexLabel })
  await expect(dialog).toBeVisible()
  expectScrollOffsetsKept(before, await scrollOffsets(page))
  return dialog
}
