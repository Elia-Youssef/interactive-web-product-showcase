// The one rule that chooses the point each authored view orbits. The home
// view orbits the model center; a close-up CAM_<id> orbits the rest
// position of its own HS_<id> anchor, so a drag in a close-up turns around
// the subject the close-up frames instead of swinging it out of the frame.
// The runtime plan, the build-time validate step and the specs' camera
// facts all choose pivots here, each in its own space: the caller passes
// the model center and the anchor rests in the space its rays are in.

import { CAMERA_HOME_ID, CAMERA_PREFIX, HOTSPOT_PREFIX } from '../product/contractNames'
import type { CameraLimitProblem } from './limits'
import type { Vec3, ViewPivot } from './view'

export type ViewPivotChoice =
  | { readonly kind: 'chosen'; readonly pivot: ViewPivot }
  | { readonly kind: 'broken'; readonly problem: CameraLimitProblem }

// The pivot of the view with the given id. A close-up whose anchor has no
// rest position is a problem of the authored data: falling back to the
// model center would present an orbit nobody authored.
export function viewPivotOf(
  viewId: string,
  modelCenter: Vec3,
  anchorRests: ReadonlyMap<string, Vec3>,
): ViewPivotChoice {
  if (viewId === CAMERA_HOME_ID) {
    return { kind: 'chosen', pivot: { point: modelCenter, subject: 'the model center' } }
  }
  const anchorName = `${HOTSPOT_PREFIX}${viewId}`
  const rest = anchorRests.get(viewId)
  if (rest === undefined) {
    return {
      kind: 'broken',
      problem: {
        rule: 'close-up-orbits-its-anchor',
        message: `the camera ${CAMERA_PREFIX}${viewId} has no ${anchorName} anchor at rest to orbit`,
      },
    }
  }
  return { kind: 'chosen', pivot: { point: rest, subject: `the ${anchorName} anchor` } }
}
