import type { ProductRigSummary } from '@lib/product'
import type { ProductRig } from './productRig'

// The plain summary of a parsed rig: what the store keeps with the ready
// status and the automation hook reports. It is computed once, when the rig
// is parsed, and never per access.
export function summarizeProductRig(rig: ProductRig): ProductRigSummary {
  return {
    parts: [...rig.parts.keys()],
    hotspots: rig.hotspots.map((hotspot) => ({ id: hotspot.id, part: hotspot.part.name })),
    cameras: [...rig.cameras.values()].map((camera) => camera.name),
    clip: { name: rig.clip.name, durationSeconds: rig.clip.duration },
    variants: [...rig.variants],
  }
}
