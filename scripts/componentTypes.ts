// The glTF accessor component type codes the asset scripts compare stored
// accessors against, named once. The library types the codes but exports
// its own table as a string-keyed record, which reads every entry as
// possibly undefined.
import type { GLTF } from '@gltf-transform/core'

export const SHORT_COMPONENT_TYPE: GLTF.AccessorComponentType = 5122
export const FLOAT_COMPONENT_TYPE: GLTF.AccessorComponentType = 5126
