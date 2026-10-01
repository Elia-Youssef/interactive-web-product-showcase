// The node naming contract between Blender and the site, as the one
// module that defines it.
// The build-time checks in scripts/ load it with plain Node and the runtime
// rig loads it through @lib/product, so both read the same strings and a
// contract rename is one edit. The module imports nothing on purpose: plain
// Node executes it straight from its .ts file.

// Every piece that moves apart in the exploded view: PART_base and friends.
export const PART_PREFIX = 'PART_'

// Hotspot anchors, parented to the part they describe: HS_driver.
export const HOTSPOT_PREFIX = 'HS_'

// Cameras: CAM_home plus an optional close-up per hotspot id: CAM_driver.
export const CAMERA_PREFIX = 'CAM_'

// The camera id of the start and reset view: CAM_home, always required.
export const CAMERA_HOME_ID = 'home'

// The one baked contact shadow plane, named in full.
export const SHADOW_NODE_NAME = 'SHADOW'
