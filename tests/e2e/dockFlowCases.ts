import type { HotspotFlow } from './hotspotFlowFacts'
import type { SwitchPair, SwitchKind } from './flowSubjects'
import type { DockLayoutSelection, DockProductSelection } from './dockFlowSelection'

export const requiredDockBehaviors = [
  'open',
  'readability',
  'close by Escape',
  'close by the card close button',
  'close by pressing the active marker',
  'close by outside dismissal',
  'reduced motion',
  'switch',
] as const
export type DockBehavior = (typeof requiredDockBehaviors)[number]

export function switchKindsOf(flow: HotspotFlow): readonly SwitchKind[] {
  const { closeUps, plains } = flow.subject
  const kinds: SwitchKind[] = []
  if (closeUps.length > 0 && plains.length > 0) kinds.push('close-up-to-plain', 'plain-to-close-up')
  if (closeUps.length > 1) kinds.push('close-up-to-close-up')
  return kinds
}

// Enumerate before the live reads choose the first pair of each transition
// kind. A hidden first Node pair cannot discard a later pressable pair.
export function switchCandidatesOf(flow: HotspotFlow): readonly SwitchPair[] {
  const { product, viewOf } = flow.subject
  return product.hotspots.flatMap((from) =>
    product.hotspots.flatMap((to) => {
      if (from.id === to.id) return []
      const fromClose = viewOf(from.id) !== null
      const toClose = viewOf(to.id) !== null
      if (!fromClose && !toClose) return []
      const kind = fromClose
        ? toClose
          ? 'close-up-to-close-up'
          : 'close-up-to-plain'
        : 'plain-to-close-up'
      return [{ kind, from, to }]
    }),
  )
}

export function selectedSwitches(
  flow: HotspotFlow,
  read: DockProductSelection,
): readonly SwitchPair[] {
  const selected = new Map<SwitchPair['kind'], SwitchPair>()
  for (const pair of switchCandidatesOf(flow)) {
    const shown =
      flow.subject.viewOf(pair.from.id) === null
        ? read.shownHome
        : read.shownAtSwitch.get(pair.from.id)
    if (read.shownHome.has(pair.from.id) && shown?.has(pair.to.id) && !selected.has(pair.kind)) {
      selected.set(pair.kind, pair)
    }
  }
  return [...selected.values()]
}

export function requireDockBehaviors(size: string, completed: ReadonlySet<string>): void {
  for (const behavior of requiredDockBehaviors) {
    if (!completed.has(behavior))
      throw new Error(`dock flow ${size}: no runnable ${behavior} case completed`)
  }
}

export function requireRunnableDockCases(
  size: string,
  flows: readonly HotspotFlow[],
  read: DockLayoutSelection,
): void {
  if (read.kind === 'list-only') return
  const anyHome = [...read.products.values()].some((product) => product.shownHome.size > 0)
  if (!anyHome) throw new Error(`dock flow ${size}: no runnable open case`)
  const closeUp = flows.some((flow) =>
    flow.subject.closeUps.some((hotspot) =>
      read.products.get(flow.subject.product.slug)?.shownHome.has(hotspot.id),
    ),
  )
  if (!closeUp) throw new Error(`dock flow ${size}: no runnable reduced motion case`)
  const switches = flows.some((flow) => {
    const product = read.products.get(flow.subject.product.slug)
    return product !== undefined && selectedSwitches(flow, product).length > 0
  })
  if (!switches) throw new Error(`dock flow ${size}: no runnable switch case`)
}
