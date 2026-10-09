import type { FlowFacts, HotspotFlow } from './hotspotFlowFacts'
import { stageBoxOf, viewportContracts } from './layoutContracts'

// Plain opens owe no stage frame when the stage box stays fixed. The app's
// desktop panel scrolls independently; the harness's dock scrolls its canvas.
// Select a shown plain marker from authored facts for that app stage, and
// fail at collection if a product's plain proof would otherwise disappear.
// The facts are the shipped products': the app has a page for those only, so
// a product outside them, such as a fixture of the test set, has no app plain.
export function applicationPlainSubjects(facts: FlowFacts) {
  const viewport = viewportContracts.find((contract) => contract.stagePosition === 'right')
  if (viewport === undefined) {
    throw new Error('the plain no-frame proof needs a desktop application layout')
  }
  const shownBySlug = facts.markerViewsAt(stageBoxOf(viewport))
  const flowBySlug = new Map(facts.flows.map((flow) => [flow.subject.product.slug, flow]))
  const plainOfFlow = (flow: HotspotFlow) => {
    if (flow.subject.plains.length === 0) {
      return undefined
    }
    const shown = shownBySlug.get(flow.subject.product.slug)
    const plain = flow.subject.plains.find((hotspot) => shown?.home.has(hotspot.id))
    if (plain === undefined) {
      throw new Error(`no shown plain marker in the app for ${flow.subject.product.slug}`)
    }
    return plain
  }
  const plainOf = (slug: string) => {
    const flow = flowBySlug.get(slug)
    return flow === undefined ? undefined : plainOfFlow(flow)
  }
  return { viewport, plainOf }
}
