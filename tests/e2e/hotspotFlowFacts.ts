import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { readProductCameraFacts, type AuthoredView, type ProductCameraFacts } from './productCamera'
import { readProductHotspotFacts, type ProductHotspotFacts } from './productHotspots'
import { harnessProducts } from './productSpecs'
import { resolvedDistanceRange, viewExpectation } from './stageCamera'
import { selectFlowSubjects, type FlowSubject } from './flowSubjects'
import { cardCloseButtonOf, markerOf } from './hotspotViews'

// The per-product facts the flow specs read: every product's authored
// camera views and hotspot facts, once per file, and the flow shape each
// spec drives. The subjects come from the product set per hotspot kind
// (selectFlowSubjects, which fails at collection when the whole set
// carries no close-up hotspot, no plain hotspot or no switch whose camera
// moves), so each test runs for every product that has what it drives.
// The camera flow (open, switch, close) lives in hotspotFlow.spec.ts, the
// card itself (follow, hide, leave, reduced motion, rest) in
// hotspotCard.spec.ts, both over these facts.

// The view expectations of one product's views at one stage aspect: the
// home view, and any authored view the specs read a hotspot's close-up
// through.
export type HotspotFlow = {
  readonly subject: FlowSubject
  readonly homeAt: (stageAspect: number) => ReturnType<typeof viewExpectation>
  readonly viewAt: (view: AuthoredView, stageAspect: number) => ReturnType<typeof viewExpectation>
}

export type FlowFacts = {
  readonly flows: readonly HotspotFlow[]
  readonly factsBySlug: ReadonlyMap<string, ProductHotspotFacts>
}

export async function flowFacts(): Promise<FlowFacts> {
  const products = await harnessProducts()
  const viewFactsBySlug = new Map<string, ProductCameraFacts>()
  for (const product of products) {
    viewFactsBySlug.set(product.slug, await readProductCameraFacts(product.slug))
  }
  const factsBySlug = new Map<string, ProductHotspotFacts>()
  for (const product of products) {
    factsBySlug.set(product.slug, await readProductHotspotFacts(product.slug, product))
  }
  return { flows: flowsOf(products, viewFactsBySlug), factsBySlug }
}

// The view expectations of every selected subject, derived once per
// product: both resolutions read the authored home aspect and the
// product's resolved distance range.
function flowsOf(
  products: readonly Product[],
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
): readonly HotspotFlow[] {
  return selectFlowSubjects(products, viewFactsBySlug).map((subject) => {
    const range = resolvedDistanceRange(subject.product, subject.viewFacts.home.distance)
    return {
      subject,
      homeAt: (stageAspect: number) =>
        viewExpectation(subject.viewFacts.home, subject.viewFacts.home.aspect, range, stageAspect),
      viewAt: (view: AuthoredView, stageAspect: number) =>
        viewExpectation(view, subject.viewFacts.home.aspect, range, stageAspect),
    }
  })
}

// The three ways to close, all through the same slice: each entry is the
// way's name and the shared close action, told which marker is open.
export type CloseWay = readonly [string, (page: Page, openTitle: string) => Promise<void>]

export const closeWays: readonly CloseWay[] = [
  ['Escape', async (page) => page.keyboard.press('Escape')],
  ['the card close button', async (page) => cardCloseButtonOf(page).click()],
  ['pressing the active marker', async (page, openTitle) => markerOf(page, openTitle).click()],
]
