// The plain summary of a parsed product rig. It is the shape the store
// keeps with the ready status and the automation hook reports, so test
// code, the dev HUD and later features can read what the rig found without
// touching the three.js scene graph. Pure data: no three.js types here,
// because the store layer may import lib only.

import { CAMERA_HOME_ID, CAMERA_PREFIX } from './contractNames'

export type ProductHotspotSummary = {
  // The manifest hotspot id: 'driver' for HS_driver.
  readonly id: string
  // The name of the PART_ node the hotspot rides on.
  readonly part: string
}

export type ProductClipSummary = {
  // The animation clip name the manifest's explode block names.
  readonly name: string
  // The clip's full length in seconds, as the loader computed it.
  readonly durationSeconds: number
}

export type ProductRigSummary = {
  // Every PART_ node name, in scene traversal order.
  readonly parts: readonly string[]
  // One entry per manifest hotspot, in manifest order.
  readonly hotspots: readonly ProductHotspotSummary[]
  // The resolved camera node names: CAM_home first, then each manifest
  // hotspot's CAM_<id> the model carries.
  readonly cameras: readonly string[]
  readonly clip: ProductClipSummary
  // The KHR_materials_variants names in declaration order.
  readonly variants: readonly string[]
}

// The hotspot ids that have a close-up: the naming contract gives an
// optional close-up camera the hotspot's own id after the CAM_ prefix, so
// a camera named after a hotspot is that hotspot's close-up. The home
// camera is no hotspot's. Callers read the set from the store's ready
// status, so the DOM side of a product knows which hotspots move the
// camera without reaching into the canvas.
export function closeUpHotspotIds(rig: ProductRigSummary): ReadonlySet<string> {
  const ids = new Set<string>()
  const homeName = `${CAMERA_PREFIX}${CAMERA_HOME_ID}`
  for (const name of rig.cameras) {
    if (!name.startsWith(CAMERA_PREFIX) || name === homeName) {
      continue
    }
    ids.add(name.slice(CAMERA_PREFIX.length))
  }
  return ids
}
