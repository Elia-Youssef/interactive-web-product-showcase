import type { Page } from '@playwright/test'
import type { FlowFacts } from './hotspotFlowFacts'
import { viewportContracts } from './layoutContracts'
import { selectMarkersAtHome } from './markerSelection'

// Register by hotspot kind, then choose the subject at the live home view
// before taking the no-frame baseline. Selection reads do not drive a frame.
export function applicationPlainSubjects(facts: FlowFacts) {
  const viewport = viewportContracts.find((contract) => contract.stagePosition === 'right')
  if (viewport === undefined) throw new Error('the plain no-frame proof needs a desktop layout')
  const flowBySlug = new Map(facts.flows.map((flow) => [flow.subject.product.slug, flow]))
  return {
    viewport,
    hasPlain: (slug: string) => (flowBySlug.get(slug)?.subject.plains.length ?? 0) > 0,
    async selectPlain(page: Page, slug: string) {
      const flow = flowBySlug.get(slug)
      if (flow === undefined) throw new Error(`no application flow for ${slug}`)
      const { shown } = await selectMarkersAtHome(page, flow.subject.product)
      const plain = flow.subject.plains.find((hotspot) => shown.has(hotspot.id))
      if (plain === undefined)
        throw new Error(`no pressable plain marker in the application for ${slug}`)
      return plain
    },
  }
}
