import type { HotspotFlow } from './hotspotFlowFacts'
import type { ProductHotspotFacts } from './productHotspots'
import type { MarkerStage, MarkerViews } from './productMarkerViews'
import { markersShownIn } from './productMarkerViews'
import { resolvedDistanceRange } from './stageCamera'
import type { AuthoredView } from './productCamera'
import type { DockOpenViewCandidate } from './dockFlowSelection'

// The farthest camera distance predicts useful fallback sources first. It never
// excludes a source: every final target still passes the live boundary.
export function dockOpenViewCandidates(
  flow: HotspotFlow,
  views: MarkerViews,
  facts: ProductHotspotFacts,
  stage: MarkerStage,
): readonly DockOpenViewCandidate[] {
  const range = resolvedDistanceRange(flow.subject.product, flow.subject.viewFacts.home.distance)
  return flow.subject.closeUps.map((closeUp) => {
    const nodeShown = views.closeUps.get(closeUp.id)
    if (nodeShown === undefined) throw new Error(`no Node close-up candidates for ${closeUp.id}`)
    return {
      hotspotId: closeUp.id,
      nodeShown: [...nodeShown],
      nodeShownZoomedOut: [...markersShownIn(facts, atDistance(closeUp.view, range.max), stage)],
    }
  })
}

function atDistance(view: AuthoredView, distance: number): AuthoredView {
  const scale = distance / view.distance
  return {
    ...view,
    distance,
    position: [
      view.target[0] + (view.position[0] - view.target[0]) * scale,
      view.target[1] + (view.position[1] - view.target[1]) * scale,
      view.target[2] + (view.position[2] - view.target[2]) * scale,
    ],
  }
}
