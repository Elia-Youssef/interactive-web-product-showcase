import type { vec3 } from '@gltf-transform/core'
import { projectToStageBox, viewDepthOf } from './hotspotPlacement'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { ProductHotspotFacts } from './productHotspots'
import { isBlocked } from './productMesh'

// Which markers the shipped model shows from its views, computed in Node
// from the hotspot facts, per authored view. The rule is the runtime's
// visibility rule restated over the shipped meshes, so the specs choose
// their subjects from the product's own geometry, never from the viewer's
// scene graph.

// Which manifest hotspots' markers each authored view shows, with the
// model assembled: the home view, and each close-up under its hotspot id.
export type MarkerViews = {
  readonly home: ReadonlySet<string>
  readonly closeUps: ReadonlyMap<string, ReadonlySet<string>>
}

// The markers every authored view of the product shows, by the runtime's
// visibility rule restated over the shipped meshes: an anchor shows when
// it stands in front of the view's camera, projects inside the view's
// authored frame, and no occluder is nearer along the ray to it. The
// authored frame is the strictest stage: a wider stage shows more of the
// scene beside it, and a narrower one pulls the camera back along the view
// until the whole frame fits, so a marker inside the frame is inside every
// stage.
export function markerViewsOf(facts: ProductHotspotFacts, views: ProductCameraFacts): MarkerViews {
  return {
    home: markersShownIn(facts, views.home),
    closeUps: new Map(
      [...views.closeUps].map(([id, view]) => [id, markersShownIn(facts, view)] as const),
    ),
  }
}

function markersShownIn(facts: ProductHotspotFacts, view: AuthoredView): ReadonlySet<string> {
  const camera = {
    position: pointOf(view.position),
    target: pointOf(view.target),
    fovY: view.fovY,
  }
  const shown = new Set<string>()
  for (const hotspot of facts.hotspots) {
    const anchor = hotspot.stagePosition
    if (viewDepthOf(camera, pointOf(anchor)) <= 0) {
      continue
    }
    const projected = projectToStageBox(camera, pointOf(anchor), { width: view.aspect, height: 1 })
    const inFrame =
      projected.x >= 0 && projected.x <= view.aspect && projected.y >= 0 && projected.y <= 1
    if (inFrame && !isBlocked(view.position, anchor, facts.occluders)) {
      shown.add(hotspot.id)
    }
  }
  return shown
}

function pointOf(tuple: vec3): { readonly x: number; readonly y: number; readonly z: number } {
  return { x: tuple[0], y: tuple[1], z: tuple[2] }
}
