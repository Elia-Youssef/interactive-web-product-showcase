import type { ViewerCameraAutomation, ViewerCameraSource } from '../automation/viewerAutomation'

// The slot the stage holds for the live camera read: the stage camera
// registers its source into it for its lifetime, and the automation hook
// reads through it. One slot per stage, so two stages never hand the
// contract over to each other, and the read stays a live read of the
// registered camera, never a copy.
export type CameraSourceSlot = {
  readonly register: (source: ViewerCameraSource | null) => void
  readonly read: () => ViewerCameraAutomation | null
}

export function createCameraSourceSlot(): CameraSourceSlot {
  let source: ViewerCameraSource | null = null
  return {
    register(next) {
      source = next
    },
    read() {
      return source === null ? null : source()
    },
  }
}
