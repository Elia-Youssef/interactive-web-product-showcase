import type { ProductLookBlock } from './schema'

// A complete look: every value a look application needs, with the unit in
// the name. Exposure multiplies the tone mapping; the environment intensity
// scales the scene's image based lighting; the environment rotation turns it
// about the vertical axis, in degrees; the shadow opacity scales the baked
// contact shadow's authored alpha.
export type ProductLookValues = {
  readonly exposure: number
  readonly environmentIntensity: number
  readonly environmentRotationDeg: number
  readonly shadowOpacity: number
}

// Fills an authored look block up to the defaults passed in, field by field.
// Pure: the schema keeps what the author wrote, and the caller owns the
// defaults, so the manifest data and the fallback values stay apart.
export function resolveProductLook(
  look: ProductLookBlock | undefined,
  defaults: ProductLookValues,
): ProductLookValues {
  return {
    exposure: look?.exposure ?? defaults.exposure,
    environmentIntensity: look?.environmentIntensity ?? defaults.environmentIntensity,
    environmentRotationDeg: look?.environmentRotationDeg ?? defaults.environmentRotationDeg,
    shadowOpacity: look?.shadowOpacity ?? defaults.shadowOpacity,
  }
}
