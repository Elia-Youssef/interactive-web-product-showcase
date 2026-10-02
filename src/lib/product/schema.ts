import { z } from 'zod'
import type { IssueSink } from './errors'
import {
  DEFAULT_EXPLODE_CLIP,
  FINISHES_MIN,
  HOTSPOT_BULLETS_MAX,
  HOTSPOT_BULLETS_MIN,
  HOTSPOT_ID_PATTERN,
  INTRO_MAX_LINES,
  LOOK_ENVIRONMENT_INTENSITY_MAX,
  LOOK_ENVIRONMENT_ROTATION_DEG_MAX,
  LOOK_EXPOSURE_MAX,
  LOOK_SHADOW_OPACITY_MAX,
  RESERVED_HOTSPOT_IDS,
  SINGLE_LINE_PATTERN,
  SLUG_PATTERN,
  SWATCH_PATTERN,
} from './rules'

// Non-empty single-line text: no line breaks, no leading or trailing
// whitespace. Manifests are validated, never silently trimmed, so a typo
// cannot pass unnoticed.
const singleLineText = z.string().regex(SINGLE_LINE_PATTERN, {
  error: 'expected non-empty single-line text without leading or trailing whitespace',
})

const finishSchema = z.strictObject({
  variant: singleLineText,
  label: singleLineText,
  swatch: z.string().regex(SWATCH_PATTERN, { error: 'expected a hex color in #RRGGBB form' }),
})

type Finish = z.output<typeof finishSchema>

const hotspotSchema = z.strictObject({
  id: z.string().regex(HOTSPOT_ID_PATTERN, {
    error: 'expected lowercase letters, digits or underscores',
  }),
  eyebrow: singleLineText,
  title: singleLineText,
  bullets: z.array(singleLineText).min(HOTSPOT_BULLETS_MIN).max(HOTSPOT_BULLETS_MAX),
})

type Hotspot = z.output<typeof hotspotSchema>

const explodeSchema = z.strictObject({
  clip: singleLineText.default(DEFAULT_EXPLODE_CLIP),
  label: singleLineText.optional(),
})

const cameraSchema = z
  .strictObject({
    minDistance: z.number().positive().optional(),
    maxDistance: z.number().positive().optional(),
  })
  .superRefine((camera, ctx) => {
    if (
      camera.minDistance === undefined ||
      camera.maxDistance === undefined ||
      camera.minDistance < camera.maxDistance
    ) {
      return
    }
    ctx.addIssue({
      code: 'custom',
      message: 'expected to be greater than minDistance',
      path: ['maxDistance'],
    })
  })

// Reports every later occurrence of an already seen value, so a manifest with
// several duplicates is fixed in one pass.
function rejectDuplicates<T>(
  items: readonly T[],
  field: string,
  valueOf: (item: T) => string,
  describe: (value: string) => string,
  ctx: IssueSink,
): void {
  const firstIndexByValue = new Map<string, number>()
  items.forEach((item, index) => {
    const value = valueOf(item)
    if (firstIndexByValue.has(value)) {
      ctx.addIssue({ code: 'custom', message: describe(value), path: [index, field] })
      return
    }
    firstIndexByValue.set(value, index)
  })
}

function rejectDuplicateFinishValues(field: 'variant' | 'label') {
  return (finishes: Finish[], ctx: IssueSink): void =>
    rejectDuplicates(
      finishes,
      field,
      (finish) => finish[field],
      (value) => `duplicate finish ${field} '${value}'`,
      ctx,
    )
}

function rejectReservedHotspotIds(hotspots: Hotspot[], ctx: IssueSink): void {
  hotspots.forEach((hotspot, index) => {
    for (const reserved of RESERVED_HOTSPOT_IDS) {
      if (hotspot.id !== reserved) {
        continue
      }
      ctx.addIssue({
        code: 'custom',
        message: `the hotspot id '${reserved}' is reserved: it would collide with CAM_${reserved}`,
        path: [index, 'id'],
      })
    }
  })
}

const finishesSchema = z
  .array(finishSchema)
  .min(FINISHES_MIN, { error: `a product needs at least ${FINISHES_MIN} finish` })
  .superRefine(rejectDuplicateFinishValues('variant'))
  .superRefine(rejectDuplicateFinishValues('label'))

const hotspotsSchema = z
  .array(hotspotSchema)
  .superRefine((hotspots, ctx) =>
    rejectDuplicates(
      hotspots,
      'id',
      (hotspot) => hotspot.id,
      (value) => `duplicate hotspot id '${value}'`,
      ctx,
    ),
  )
  .superRefine(rejectReservedHotspotIds)

// The per-product look: what the author wrote, with no defaults filled in.
// Every field is optional and the block is strict, so the resolution layer
// owns the fallbacks and a typo never passes silently.
export const productLookSchema = z.strictObject({
  exposure: z
    .number()
    .positive({ error: 'expected a number greater than 0' })
    .max(LOOK_EXPOSURE_MAX, { error: `expected a number at most ${LOOK_EXPOSURE_MAX}` })
    .optional(),
  environmentIntensity: z
    .number()
    .min(0, { error: 'expected a number of at least 0' })
    .max(LOOK_ENVIRONMENT_INTENSITY_MAX, {
      error: `expected a number at most ${LOOK_ENVIRONMENT_INTENSITY_MAX}`,
    })
    .optional(),
  environmentRotationDeg: z
    .number()
    .min(0, { error: 'expected a number of at least 0' })
    .lt(LOOK_ENVIRONMENT_ROTATION_DEG_MAX, {
      error: `expected a number below ${LOOK_ENVIRONMENT_ROTATION_DEG_MAX}`,
    })
    .optional(),
  shadowOpacity: z
    .number()
    .min(0, { error: 'expected a number of at least 0' })
    .max(LOOK_SHADOW_OPACITY_MAX, { error: `expected a number at most ${LOOK_SHADOW_OPACITY_MAX}` })
    .optional(),
})

export type ProductLookBlock = z.output<typeof productLookSchema>

// The single source of truth for what a product manifest is. Every object is
// strict, so an unknown key is an error and a typo never passes silently.
export const productManifestSchema = z.strictObject({
  slug: z.string().regex(SLUG_PATTERN, {
    error: 'expected lowercase kebab case: words of a-z and 0-9 separated by single hyphens',
  }),
  number: z.number().int().positive(),
  category: singleLineText,
  brand: singleLineText,
  model: singleLineText,
  eyebrow: singleLineText,
  tagline: singleLineText,
  intro: z.array(singleLineText).max(INTRO_MAX_LINES),
  finishes: finishesSchema,
  hotspots: hotspotsSchema,
  // Normalized with prefault, not defaulted: a parsed product always
  // carries the block, so every reader of explode.clip can trust the clip
  // name without repeating the default. The input keeps the block optional.
  explode: explodeSchema.prefault({}),
  camera: cameraSchema.optional(),
  // Unlike explode, the look block keeps what the author wrote: the
  // resolution layer fills the defaults, because its own defaults are
  // viewer config, not schema data.
  look: productLookSchema.optional(),
})

export type ProductInput = z.input<typeof productManifestSchema>
export type Product = z.output<typeof productManifestSchema>
