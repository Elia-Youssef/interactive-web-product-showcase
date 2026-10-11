import { test } from './fixtures'
import type { HotspotFlow } from './hotspotFlowFacts'
import type { SwitchKind } from './flowSubjects'
import type { DockLayoutSelection } from './dockFlowSelection'
import { selectedSwitches } from './dockFlowCases'

export function dockSelectionAt(
  reads: ReadonlyMap<string, DockLayoutSelection>,
  size: string,
): DockLayoutSelection {
  const read = reads.get(size)
  if (read === undefined) throw new Error(`the ${size} layout must be read before its cases run`)
  return read
}

export function skipUnlessDockFlow(read: DockLayoutSelection, size: string): void {
  test.skip(
    read.kind === 'list-only',
    `no product shows a marker at ${size}: the Highlights list is the route to a card there`,
  )
}

export function skipUnlessMarkerShown(
  read: DockLayoutSelection,
  size: string,
  slug: string,
  id: string,
  title: string,
): void {
  skipUnlessDockFlow(read, size)
  const product = read.products.get(slug)
  if (product === undefined) throw new Error(`no live product selection for ${slug} at ${size}`)
  test.skip(!product.shownHome.has(id), `the page hides ${title} at ${size}`)
}

export function selectedDockSwitchOf(
  read: DockLayoutSelection,
  size: string,
  flow: HotspotFlow,
  kind: SwitchKind,
) {
  skipUnlessDockFlow(read, size)
  const product = read.products.get(flow.subject.product.slug)
  if (product === undefined) throw new Error(`no live switch selection at ${size}`)
  const pair = selectedSwitches(flow, product).find((entry) => entry.kind === kind)
  test.skip(
    pair === undefined,
    `no pressable ${kind} switch for ${flow.subject.product.slug} at ${size}`,
  )
  return pair
}
