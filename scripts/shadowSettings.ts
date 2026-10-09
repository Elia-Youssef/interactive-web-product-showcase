// Shared authoring and shipped-byte shadow settings. The encode shift is
// the largest per-side threshold crossing measured on the shipped images;
// it supplements, rather than replaces, the decoded image's fit precision.
import { readFileSync } from 'node:fs'
import { z } from 'zod'

export const shadowSettingsSchema = z.strictObject({
  alphaThreshold: z.number().min(0).max(1),
  padM: z.number().nonnegative(),
  fitToleranceTexels: z.number().int().nonnegative(),
  etc1sFootprintShiftTexels: z.number().int().nonnegative(),
})

export const SHADOW_SETTINGS = shadowSettingsSchema.parse(
  JSON.parse(
    readFileSync(new URL('../assets/blender/shadow-footprint.json', import.meta.url), 'utf8'),
  ),
)

export const SHIPPED_FIT_TOLERANCE_TEXELS =
  SHADOW_SETTINGS.fitToleranceTexels + SHADOW_SETTINGS.etc1sFootprintShiftTexels
