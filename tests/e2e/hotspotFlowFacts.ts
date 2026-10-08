import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { readProductCameraFacts, type AuthoredView, type ProductCameraFacts } from './productCamera'
import { readProductHotspotFacts, type ProductHotspotFacts } from './productHotspots'
import { markerViewsOf, type MarkerStage, type MarkerViews } from './productMarkerViews'
import { harnessStageBox } from './e2eViewport'
import { readMarkerExtentTokens } from './markerExtentTokens'
import { harnessProducts } from './productSpecs'
import { resolvedDistanceRange, viewExpectation } from './stageCamera'
import { selectFlowSubjects, type FlowSubject } from './flowSubjects'
import { cardCloseButtonOf, harnessCanvasDrivePoint, markerOf } from './hotspotViews'

// The per-product facts the flow specs read: every product's authored
// camera views and hotspot facts, once per file, and the flow shape each
// spec drives. The subjects come from the product set per hotspot kind
// (selectFlowSubjects, which fails at collection when the whole set
// carries no close-up hotspot, no plain hotspot or no switch whose camera
// moves), so each test runs for every product that has what it drives.
// The set is the test set by default, as the harness specs drive it; a
// spec that drives the site's own pages passes the shipped collection's
// products, since a fixture product has no site route. The camera flow
// (open, switch, close) lives in hotspotFlow.spec.ts, the card itself
// (follow, hide, leave, reduced motion, rest) in hotspotCard.spec.ts,
// both over these facts.

// The view expectations of one product's views at one stage aspect: the
// home view, and any authored view the specs read a hotspot's close-up
// through.
export type HotspotFlow = {
  readonly subject: FlowSubject
  readonly homeAt: (stageAspect: number) => ReturnType<typeof viewExpectation>
  readonly viewAt: (view: AuthoredView, stageAspect: number) => ReturnType<typeof viewExpectation>
}

export type FlowFacts = {
  // The flows on the harness stage, where the harness specs run.
  readonly flows: readonly HotspotFlow[]
  // The flows on any other stage box: which markers a view shows depends
  // on the stage's size, so a spec running at another viewport selects its
  // subjects for its own stage.
  readonly flowsAt: (box: MarkerStage['box']) => readonly HotspotFlow[]
  readonly factsBySlug: ReadonlyMap<string, ProductHotspotFacts>
  // Which markers each product's views show on a stage box.
  readonly markerViewsAt: (box: MarkerStage['box']) => ReadonlyMap<string, MarkerViews>
}

export async function flowFacts(productsOverride?: readonly Product[]): Promise<FlowFacts> {
  const products = productsOverride ?? (await harnessProducts())
  const viewFactsBySlug = new Map<string, ProductCameraFacts>()
  const factsBySlug = new Map<string, ProductHotspotFacts>()
  for (const product of products) {
    viewFactsBySlug.set(product.slug, await readProductCameraFacts(product.slug))
    factsBySlug.set(product.slug, await readProductHotspotFacts(product.slug, product))
  }
  const extent = await readMarkerExtentTokens()
  const markerViewsAt = (box: MarkerStage['box']): ReadonlyMap<string, MarkerViews> => {
    const markerViewsBySlug = new Map<string, MarkerViews>()
    for (const product of products) {
      const facts = factsBySlug.get(product.slug)
      const views = viewFactsBySlug.get(product.slug)
      if (facts === undefined || views === undefined) {
        throw new Error(`no hotspot or view facts for ${product.slug}`)
      }
      markerViewsBySlug.set(product.slug, markerViewsOf(facts, views, { box, extent }))
    }
    return markerViewsBySlug
  }
  const flowsAt = (box: MarkerStage['box']) =>
    flowsOf(products, viewFactsBySlug, markerViewsAt(box))
  return { flows: flowsAt(harnessStageBox), flowsAt, factsBySlug, markerViewsAt }
}

// The view expectations of every selected subject, derived once per
// product: both resolutions read the authored home aspect and the
// product's resolved distance range.
function flowsOf(
  products: readonly Product[],
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
  markerViewsBySlug: ReadonlyMap<string, MarkerViews>,
): readonly HotspotFlow[] {
  return selectFlowSubjects(products, viewFactsBySlug, markerViewsBySlug).map((subject) => {
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

// The ways to close, all through the same slice: each entry is the
// way's name and the shared close action, told which marker is open.
export type CloseWay = readonly [string, (page: Page, openTitle: string) => Promise<void>]

export const closeWays: readonly CloseWay[] = [
  ['Escape', async (page) => page.keyboard.press('Escape')],
  ['the card close button', async (page) => cardCloseButtonOf(page).click()],
  ['pressing the active marker', async (page, openTitle) => markerOf(page, openTitle).click()],
  [
    'outside dismissal',
    async (page) => {
      const point = await harnessCanvasDrivePoint(page)
      await page.mouse.click(point.x, point.y)
    },
  ],
]
