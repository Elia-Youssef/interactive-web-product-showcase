import type { Page } from '@playwright/test'
import type { DockLayoutCandidates, DockProductSelection } from './dockFlowSelection'
import { expectProduct, productPathOf } from './collectionFacts'
import { markerOf, titleOf } from './hotspotViews'
import { completedPresentation } from './presentationCompletion'
import { switchMarkerView } from './switchMarkerView'

// Native source views are preferred. If none exposes a switch target,
// probe visitor zoom routes, prioritizing sources with more Node targets.
// Stop once the layout has a runnable switch, not once a product does.
export async function selectDockSwitchView(
  page: Page,
  backendPath: string,
  layout: DockLayoutCandidates,
  products: Map<string, DockProductSelection>,
): Promise<void> {
  if (hasSwitch(layout, products)) return
  const candidates = layout.products
    .flatMap((candidate) =>
      candidate.openViews
        .filter((view) => products.get(candidate.product.slug)?.shownHome.has(view.hotspotId))
        .map((view) => ({ candidate, view })),
    )
    .sort(
      (a, b) =>
        b.view.nodeShownZoomedOut.filter((id) => id !== b.view.hotspotId).length -
        a.view.nodeShownZoomedOut.filter((id) => id !== a.view.hotspotId).length,
    )
  for (const { candidate, view } of candidates) {
    const { product } = candidate
    const read = products.get(product.slug)
    if (read === undefined) throw new Error('a switch source needs its home selection')
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await completedPresentation(page)
    await markerOf(page, titleOf(product, view.hotspotId)).click()
    await completedPresentation(page)
    const zoomed = await switchMarkerView(page, product, (shown) =>
      [...shown].some((id) => id !== view.hotspotId),
    )
    products.set(product.slug, {
      ...read,
      shownAtSwitch: new Map(read.shownAtSwitch).set(view.hotspotId, zoomed.shown),
      zoomedSwitchSources: new Set(read.zoomedSwitchSources).add(view.hotspotId),
    })
    await page.keyboard.press('Escape')
    await completedPresentation(page)
    if (hasSwitch(layout, products)) return
  }
}

function hasSwitch(
  layout: DockLayoutCandidates,
  products: ReadonlyMap<string, DockProductSelection>,
): boolean {
  return layout.products.some((candidate) => {
    const read = products.get(candidate.product.slug)
    if (read === undefined) throw new Error('a switch needs a live product selection')
    const closeUps = new Set(candidate.openViews.map((view) => view.hotspotId))
    return [...read.shownHome].some((from) => {
      const shown = closeUps.has(from) ? read.shownAtSwitch.get(from) : read.shownHome
      return (
        shown !== undefined &&
        [...shown].some((to) => to !== from && (closeUps.has(from) || closeUps.has(to)))
      )
    })
  })
}
