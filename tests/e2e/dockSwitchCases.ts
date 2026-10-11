import { expect, test } from './fixtures'
import type { HotspotFlow } from './hotspotFlowFacts'
import type { ViewportContract } from './layoutContracts'
import type { DockLayoutSelection } from './dockFlowSelection'
import type { SwitchKind } from './flowSubjects'
import { switchKindsOf } from './dockFlowCases'
import { dockSelectionAt, selectedDockSwitchOf } from './dockCaseSelection'
import { exposeDockSwitchTarget, expectDockSwitchCamera } from './dockSwitchDrive'
import { openDockedCard, scrollSheetToEnd, expectDockedCardOf } from './dockCardViews'
import { cardHeadingOf, markerOf } from './hotspotViews'
import { dockVisitorZoomBudgetMs } from './dockProbeBudget'

export function registerDockSwitchCases(
  flow: HotspotFlow,
  contract: ViewportContract,
  selection: ReadonlyMap<string, DockLayoutSelection>,
  completed: Set<string>,
): void {
  for (const kind of switchKindsOf(flow)) {
    for (const scrolled of [true, false])
      registerSwitchCase(flow, contract, selection, completed, kind, scrolled)
  }
}

function registerSwitchCase(
  flow: HotspotFlow,
  contract: ViewportContract,
  selection: ReadonlyMap<string, DockLayoutSelection>,
  completed: Set<string>,
  kind: SwitchKind,
  scrolled: boolean,
): void {
  const { product } = flow.subject
  const size = `${contract.width}x${contract.height}`
  const outcome = scrolled
    ? 'on a scrolled sheet docks the new card into view'
    : 'docks one card at a time'
  test(`docked card at ${size}: ${product.slug} switching by ${kind} ${outcome}`, async ({
    page,
    backendPath,
  }, testInfo) => {
    const pair = selectedDockSwitchOf(dockSelectionAt(selection, size), size, flow, kind)
    if (pair === undefined) return
    await testInfo.attach('dock-switch-subject', {
      body: JSON.stringify({ size, slug: product.slug, kind, from: pair.from.id, to: pair.to.id }),
      contentType: 'application/json',
    })
    const read = dockSelectionAt(selection, size).products.get(product.slug)
    if (read === undefined) throw new Error('a switch requires its live selection')
    if (read.zoomedSwitchSources.has(pair.from.id)) test.setTimeout(dockVisitorZoomBudgetMs())
    await openDockedCard(page, backendPath, product, contract, pair.from.title)
    await exposeDockSwitchTarget(page, flow, pair, read)
    if (scrolled) await scrollSheetToEnd(page)
    await markerOf(page, pair.to.title).click()
    await expectDockedCardOf(page, pair.to.title)
    await expectDockSwitchCamera(page, flow, pair)
    await expect(cardHeadingOf(page, pair.from.title)).toHaveCount(0)
    await expect(page.getByTestId('hotspot-card')).toHaveCount(1)
    completed.add('switch')
  })
}
