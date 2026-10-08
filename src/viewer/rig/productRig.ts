import type { AnimationClip, Camera, Object3D } from 'three'
import type { ModelBounds } from '@lib/camera/frame'
import type { Vec3 } from '@lib/camera/view'

// One resolved hotspot of the rig: the manifest hotspot id, its HS_<id>
// node and the PART_ node the hotspot rides on.
export type ProductHotspot = {
  readonly id: string
  readonly node: Object3D
  readonly part: Object3D
}

// The typed contract of a loaded product, as the runtime features read it.
// Every lookup a later feature would redo by name over the scene graph is
// resolved and typed here, once, at parse time: the parts of the exploded
// view, the hotspots and the parts they ride, the cameras, the shadow, the
// explode clip, the finish variants and the anchors' rest positions.
export type ProductRig = {
  // Every PART_* node, by full node name.
  readonly parts: ReadonlyMap<string, Object3D>
  // One per manifest hotspot, in manifest order.
  readonly hotspots: readonly ProductHotspot[]
  // CAM_home under the 'home' id, plus each manifest hotspot id the model
  // carries a CAM_<id> camera for.
  readonly cameras: ReadonlyMap<string, Camera>
  // The one baked contact shadow plane.
  readonly shadow: Object3D
  // The one animation the manifest's explode block names.
  readonly clip: AnimationClip
  // The KHR_materials_variants names in declaration order.
  readonly variants: readonly string[]
  // Every hotspot anchor's rest position by hotspot id, read from the node
  // transforms at parse time, in the loaded scene's own space (see
  // anchorRest.ts): the points the close-up views orbit.
  readonly anchorRest: ReadonlyMap<string, Vec3>
  // The bounds of the parts at the explode clip's last key, in the loaded
  // scene's own space, the shadow subtree excluded (see explodedBounds.ts):
  // the model half of the home view's reach rule at the explode's end.
  // null when no part subtree carries geometry to pose.
  readonly explodedBounds: ModelBounds | null
}
