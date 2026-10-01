// The plain summary of a parsed product rig. It is the shape the store
// keeps with the ready status and the automation hook reports, so test
// code, the dev HUD and later features can read what the rig found without
// touching the three.js scene graph. Pure data: no three.js types here,
// because the store layer may import lib only.

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
