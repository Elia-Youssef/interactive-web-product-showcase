import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { readProductViewFacts, type ProductViewFacts } from './productCamera'
import { readProductHotspotFacts, type ProductHotspotFacts } from './productHotspots'
import { harnessProducts } from './productSpecs'
import { resolvedDistanceRange, viewExpectation } from './stageCamera'
import { cardCloseButtonOf, markerOf } from './hotspotViews'

// The per-product facts the flow specs read: every product's authored
// camera views and hotspot facts, once per file, and the flow shape each
// spec drives. The camera flow (open, switch, close) lives in
// hotspotFlow.spec.ts, the card itself (follow, hide, leave, reduced
// motion, rest) in hotspotCard.spec.ts, both over these facts.

// The page-level facts of one product's flow: the hotspot with a close-up,
// the one without, and the expectations of the home and close-up views at
// one stage aspect. The product set must carry both kinds, or the flow has
// no contrast to prove.
export type HotspotFlow = {
  readonly viewFacts: ProductViewFacts
  readonly closeUp: Product['hotspots'][number]
  readonly plain: Product['hotspots'][number]
  readonly homeAt: (stageAspect: number) => ReturnType<typeof viewExpectation>
  readonly closeUpAt: (stageAspect: number) => ReturnType<typeof viewExpectation>
}

export type FlowFacts = {
  readonly products: readonly Product[]
  readonly flowBySlug: ReadonlyMap<string, HotspotFlow>
  readonly factsBySlug: ReadonlyMap<string, ProductHotspotFacts>
}

export async function flowFacts(): Promise<FlowFacts> {
  const products = await harnessProducts()
  const flowBySlug = new Map<string, HotspotFlow>()
  const factsBySlug = new Map<string, ProductHotspotFacts>()
  for (const product of products) {
    factsBySlug.set(product.slug, await readProductHotspotFacts(product.slug, product))
    flowBySlug.set(product.slug, flowOf(product, await readProductViewFacts(product.slug)))
  }
  return { products, flowBySlug, factsBySlug }
}

function flowOf(product: Product, viewFacts: ProductViewFacts): HotspotFlow {
  const closeUp = product.hotspots.find((hotspot) => viewFacts.closeUps.has(hotspot.id))
  const plain = product.hotspots.find((hotspot) => !viewFacts.closeUps.has(hotspot.id))
  if (closeUp === undefined) {
    throw new Error(`the flow proof needs a hotspot with a close-up in ${product.slug}`)
  }
  if (plain === undefined) {
    throw new Error(`the flow proof needs a hotspot without a close-up in ${product.slug}`)
  }
  const closeUpView = viewFacts.closeUps.get(closeUp.id)
  if (closeUpView === undefined) {
    throw new Error(`no authored view facts for ${closeUp.id}`)
  }
  const range = resolvedDistanceRange(product, viewFacts.home.distance)
  return {
    viewFacts,
    closeUp,
    plain,
    homeAt: (stageAspect: number) =>
      viewExpectation(viewFacts.home, viewFacts.home.aspect, range, stageAspect),
    closeUpAt: (stageAspect: number) =>
      viewExpectation(closeUpView, viewFacts.home.aspect, range, stageAspect),
  }
}

// The three ways to close, all through the same slice: each entry is the
// way's name and the shared close action, told which marker is open.
export type CloseWay = readonly [string, (page: Page, openTitle: string) => Promise<void>]

export const closeWays: readonly CloseWay[] = [
  ['Escape', async (page) => page.keyboard.press('Escape')],
  ['the card close button', async (page) => cardCloseButtonOf(page).click()],
  ['pressing the active marker', async (page, openTitle) => markerOf(page, openTitle).click()],
]
