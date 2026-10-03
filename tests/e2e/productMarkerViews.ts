import type { vec3 } from '@gltf-transform/core'
import { projectToStageBox, viewDepthOf } from './hotspotPlacement'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { ProductHotspotFacts } from './productHotspots'
import { isBlocked } from './productMesh'

// Which markers the shipped model shows from its views, computed in Node
// from the hotspot facts: per authored view, and the azimuth swing from
// home a drag can turn through with a marker still shown. The rule is the
// runtime's visibility rule restated over the shipped meshes, so the specs
// choose their subjects from the product's own geometry, never from the
// viewer's scene graph.

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

// The sampling step of the shown swing: fine against the drive's ten
// degree landing tolerance, so the swing the drive aims at stands well
// inside the sampled arc.
const SWING_STEP_RAD = Math.PI / 36

// The azimuth swing from home a pure drag can aim at with markers to show:
// along the turn direction whose arc reaches farther, the widest arc from
// home over which every sampled orbit pose shows at least one marker, and
// the middle of that arc as the swing, so a drive that lands within its
// tolerance of the swing still lands inside the arc. Signed in the
// controls' azimuth convention. A drag turns the camera about the vertical
// axis through the orbit target at the presented distance, so the poses
// are the home view turned about that axis.
export function shownSwingOf(facts: ProductHotspotFacts, home: AuthoredView): number {
  const reach = (direction: 1 | -1): number => {
    let reached = 0
    for (let angle = SWING_STEP_RAD; angle <= Math.PI; angle += SWING_STEP_RAD) {
      if (markersShownIn(facts, turnedView(home, direction * angle)).size === 0) {
        break
      }
      reached = angle
    }
    return direction * reached
  }
  const up = reach(1)
  const down = reach(-1)
  return (Math.abs(up) >= Math.abs(down) ? up : down) / 2
}

// The view turned by the angle about the vertical axis through its target.
function turnedView(view: AuthoredView, angle: number): AuthoredView {
  const offset = [
    view.position[0] - view.target[0],
    view.position[1] - view.target[1],
    view.position[2] - view.target[2],
  ] as const
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const position: vec3 = [
    view.target[0] + offset[0] * cos + offset[2] * sin,
    view.target[1] + offset[1],
    view.target[2] - offset[0] * sin + offset[2] * cos,
  ]
  return { ...view, position, azimuthDegrees: view.azimuthDegrees + (angle * 180) / Math.PI }
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
