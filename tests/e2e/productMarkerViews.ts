import type { vec3 } from '@gltf-transform/core'
import type { MarkerExtent } from '../../src/lib/hotspots/markerBox'
import { projectToStageBox, viewDepthOf } from './hotspotPlacement'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { ProductHotspotFacts } from './productHotspots'
import { isBlocked } from './productMesh'
import type { Mesh } from 'three'
import { containedScale } from './stageCamera'

// Which markers the shipped model shows from its views on one stage,
// computed in Node from the hotspot facts: per authored view, and the
// azimuth swing from home a drag can turn through with a marker still
// shown. These candidates prove projection, stage fit and occlusion over the
// shipped meshes; markerSelection adds the live CSS chrome before a routed
// marker press. The specs choose their subjects from the product's own
// geometry, never from the viewer's scene graph. A marker shows only while
// its whole keep-out box fits the stage, so what a view shows depends on
// the stage's size in pixels: every fact here is for the stage box the
// spec runs at, and holds for no other.

// The stage a spec runs at, in CSS pixels, and the marker extent the
// stylesheets declare.
export type MarkerStage = {
  readonly box: { readonly width: number; readonly height: number }
  readonly extent: MarkerExtent
}

// Which manifest hotspots' markers each authored view shows, with the
// model assembled: the home view, and each close-up under its hotspot id.
export type MarkerViews = {
  readonly home: ReadonlySet<string>
  readonly closeUps: ReadonlyMap<string, ReadonlySet<string>>
}

// The markers every authored view of the product shows on the stage, by
// the runtime's visibility rule restated over the shipped meshes: an
// anchor shows when it stands in front of the presented camera, the
// marker's whole keep-out box (the hit box grown by the ring's reach,
// centered on the projection) fits inside the stage box, and no occluder
// is nearer along the ray to it. The presented camera is the view's under
// the stage's contain rule: on a stage narrower than the authored aspect it
// stands back along the view from the orbit target until the authored
// frame fits.
export function markerViewsOf(
  facts: ProductHotspotFacts,
  views: ProductCameraFacts,
  stage: MarkerStage,
): MarkerViews {
  return {
    home: markersShownIn(facts, views.home, stage),
    closeUps: new Map(
      [...views.closeUps].map(([id, view]) => [id, markersShownIn(facts, view, stage)] as const),
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
export function shownSwingOf(
  facts: ProductHotspotFacts,
  home: AuthoredView,
  stage: MarkerStage,
): number {
  const reach = (direction: 1 | -1): number => {
    let reached = 0
    for (let angle = SWING_STEP_RAD; angle <= Math.PI; angle += SWING_STEP_RAD) {
      if (markersShownIn(facts, turnedView(home, direction * angle), stage).size === 0) {
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

// The anchors and the occluders the visibility rule reads, in stage space:
// the shipped model at rest (the hotspot facts), or posed at one explode
// progress.
export type MarkerScene = {
  readonly hotspots: readonly { readonly id: string; readonly stagePosition: vec3 }[]
  readonly occluders: Mesh[]
}

// The markers one view shows of the scene on the stage, by the runtime's
// visibility rule restated (see markerViewsOf).
export function markersShownIn(
  facts: MarkerScene,
  view: Pick<AuthoredView, 'position' | 'target' | 'fovY' | 'aspect'>,
  stage: MarkerStage,
): ReadonlySet<string> {
  const scale = containedScale(view.aspect, stage.box.width / stage.box.height)
  const position: vec3 = [
    view.target[0] + (view.position[0] - view.target[0]) * scale,
    view.target[1] + (view.position[1] - view.target[1]) * scale,
    view.target[2] + (view.position[2] - view.target[2]) * scale,
  ]
  const camera = { position: pointOf(position), target: pointOf(view.target), fovY: view.fovY }
  const half = stage.extent.markerHitPx / 2 + stage.extent.focusOutsetPx
  const shown = new Set<string>()
  for (const hotspot of facts.hotspots) {
    const anchor = hotspot.stagePosition
    if (viewDepthOf(camera, pointOf(anchor)) <= 0) {
      continue
    }
    const projected = projectToStageBox(camera, pointOf(anchor), stage.box)
    const boxFits =
      projected.x - half >= 0 &&
      projected.x + half <= stage.box.width &&
      projected.y - half >= 0 &&
      projected.y + half <= stage.box.height
    if (boxFits && !isBlocked(position, anchor, facts.occluders)) {
      shown.add(hotspot.id)
    }
  }
  return shown
}

function pointOf(tuple: vec3): { readonly x: number; readonly y: number; readonly z: number } {
  return { x: tuple[0], y: tuple[1], z: tuple[2] }
}
