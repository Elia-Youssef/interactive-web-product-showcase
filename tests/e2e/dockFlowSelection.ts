import type { Browser, Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { expectProduct, productPathOf } from './collectionFacts'
import { completedPresentation } from './presentationCompletion'
import { markerOf, titleOf } from './hotspotViews'
import { selectMarkersAtView } from './markerSelection'
import { withOwnedSetupPage } from './ownedSetupPage'
import { selectDockSwitchView } from './dockSwitchSelection'

export type DockOpenViewCandidate = {
  readonly hotspotId: string
  readonly nodeShown: readonly string[]
  readonly nodeShownZoomedOut: readonly string[]
}
export type DockProductCandidates = {
  readonly product: Product
  readonly nodeShownHome: readonly string[]
  readonly openViews: readonly DockOpenViewCandidate[]
}
export type DockLayoutCandidates = {
  readonly width: number
  readonly height: number
  readonly products: readonly DockProductCandidates[]
}
export type DockProductSelection = {
  readonly shownHome: ReadonlySet<string>
  readonly chromeHiddenHome: readonly string[]
  readonly shownAtOpen: ReadonlyMap<string, ReadonlySet<string>>
  readonly shownAtSwitch: ReadonlyMap<string, ReadonlySet<string>>
  readonly zoomedSwitchSources: ReadonlySet<string>
}
export type DockLayoutSelection = {
  readonly kind: 'dock-flow' | 'list-only'
  readonly products: ReadonlyMap<string, DockProductSelection>
}

// One owned setup page per probe, reused across its product/layout reads.
// Eligibility is marker pressability at the source view, never readability
// of the destination card. Each close-up read includes its open and return.
export async function selectDockFlowLayouts(
  browser: Browser,
  backendPath: string,
  layouts: readonly DockLayoutCandidates[],
): Promise<Map<string, DockLayoutSelection>> {
  return withOwnedSetupPage(browser, async (page) => {
    const selections = new Map<string, DockLayoutSelection>()
    for (const layout of layouts) {
      const size = `${layout.width}x${layout.height}`
      const products = new Map<string, DockProductSelection>()
      for (const candidate of layout.products) {
        products.set(
          candidate.product.slug,
          await selectProduct(page, backendPath, layout, candidate),
        )
      }
      const anyShown = [...products.values()].some((read) => read.shownHome.size > 0)
      if (anyShown) await selectDockSwitchView(page, backendPath, layout, products)
      if (!anyShown) {
        for (const candidate of layout.products) {
          const read = products.get(candidate.product.slug)
          if (read === undefined) throw new Error(`missing live selection at ${size}`)
          for (const hotspot of candidate.product.hotspots) {
            if (!read.chromeHiddenHome.includes(hotspot.id)) {
              throw new Error(
                `list-only ${size}: chrome does not explain ${candidate.product.slug}/${hotspot.id}`,
              )
            }
          }
        }
      }
      selections.set(size, { kind: anyShown ? 'dock-flow' : 'list-only', products })
    }
    return selections
  })
}

async function selectProduct(
  page: Page,
  backendPath: string,
  layout: DockLayoutCandidates,
  candidate: DockProductCandidates,
): Promise<DockProductSelection> {
  const { product } = candidate
  await page.setViewportSize({ width: layout.width, height: layout.height })
  await page.goto(productPathOf(backendPath, product))
  await expectProduct(page, product)
  await completedPresentation(page)
  const home = await selectMarkersAtView(page, product, new Set(candidate.nodeShownHome), 'home')
  const shownAtOpen = new Map<string, ReadonlySet<string>>()
  for (const view of candidate.openViews.filter((entry) => home.shown.has(entry.hotspotId))) {
    await markerOf(page, titleOf(product, view.hotspotId)).click()
    await completedPresentation(page)
    const read = await selectMarkersAtView(
      page,
      product,
      new Set(view.nodeShown),
      `close-up ${view.hotspotId}`,
    )
    shownAtOpen.set(view.hotspotId, read.shown)
    await page.keyboard.press('Escape')
    await completedPresentation(page)
  }
  return {
    shownHome: home.shown,
    chromeHiddenHome: home.chromeHidden,
    shownAtOpen,
    shownAtSwitch: new Map(shownAtOpen),
    zoomedSwitchSources: new Set(),
  }
}

export function dockClassificationReport(size: string, read: DockLayoutSelection): string {
  return JSON.stringify({
    size,
    kind: read.kind,
    products: [...read.products.entries()].map(([slug, product]) => ({
      slug,
      shownHome: [...product.shownHome],
      chromeHiddenHome: product.chromeHiddenHome,
      shownAtOpen: [...product.shownAtOpen].map(([id, shown]) => [id, [...shown]]),
      shownAtSwitch: [...product.shownAtSwitch].map(([id, shown]) => [id, [...shown]]),
      zoomedSwitchSources: [...product.zoomedSwitchSources],
    })),
  })
}
