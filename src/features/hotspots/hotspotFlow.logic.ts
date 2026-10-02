import { CAMERA_HOME_ID } from '@lib/product'
import type { CameraRequest } from '@store/index'

// The camera request a hotspot selection change owes, or null when it owes
// no move. The rule is the flow's own, over the selection before the
// change, the selection after it, and the set of hotspot ids that have a
// close-up camera:
//
// - idle to a hotspot: that hotspot's close-up if it has one, else no move;
// - a hotspot to idle: home if the closed hotspot has a close-up, else no
//   move;
// - a hotspot to another: the new hotspot's close-up if it has one; else
//   home if the closed hotspot had one; else no move.
//
// So a hotspot without a close-up opens and closes without moving the
// camera, and a switch between two close-ups moves straight to the new one.
// The DOM side dispatches the owed request through the store's camera
// request channel; nothing else in the feature moves the camera.
export function hotspotCameraRequest(
  before: string | null,
  after: string | null,
  closeUps: ReadonlySet<string>,
): CameraRequest | null {
  if (after !== null && closeUps.has(after)) {
    return { kind: 'view', viewId: after }
  }
  if (before !== null && closeUps.has(before)) {
    return { kind: 'view', viewId: CAMERA_HOME_ID }
  }
  return null
}
