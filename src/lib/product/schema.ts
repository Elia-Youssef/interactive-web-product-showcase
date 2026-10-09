import { z } from 'zod/mini'
import type { IssueSink } from './errors'
import {
  DEFAULT_EXPLODE_CLIP,
  EYEBROW_TRAILING_NUMBER_PATTERN,
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

// The schema language is zod's functional core, which ships no default
// error messages: the rules below that carry no authored message read
// theirs from the English locale the validation boundary passes with every
// parse (parseWithMessages in lib/validation.ts), and every rule that names
// its own error outranks it.

// Non-empty single-line text: no line breaks, no leading or trailing
// whitespace. Manifests are validated, never silently trimmed, so a typo
// cannot pass unnoticed.
const singleLineText = z.string().check(
  z.regex(SINGLE_LINE_PATTERN, {
    error: 'expected non-empty single-line text without leading or trailing whitespace',
  }),
)

// The product eyebrow: the product kind in single-line text, without the
// number the site appends to it. The hotspot eyebrows are plain text.
const productEyebrowText = singleLineText.check(
  z.refine((value) => !EYEBROW_TRAILING_NUMBER_PATTERN.test(value), {
    error:
      'expected the product kind without a trailing number or separator: the site appends the product number',
  }),
)

const finishSchema = z.strictObject({
  variant: singleLineText,
  label: singleLineText,
  swatch: z
    .string()
    .check(z.regex(SWATCH_PATTERN, { error: 'expected a hex color in #RRGGBB form' })),
})

type Finish = z.output<typeof finishSchema>

const hotspotSchema = z.strictObject({
  id: z.string().check(
    z.regex(HOTSPOT_ID_PATTERN, {
      error: 'expected lowercase letters, digits or underscores',
    }),
  ),
  eyebrow: singleLineText,
  title: singleLineText,
  bullets: z
    .array(singleLineText)
    .check(z.minLength(HOTSPOT_BULLETS_MIN), z.maxLength(HOTSPOT_BULLETS_MAX)),
})

type Hotspot = z.output<typeof hotspotSchema>

const explodeSchema = z.strictObject({
  clip: z._default(singleLineText, DEFAULT_EXPLODE_CLIP),
  label: z.optional(singleLineText),
})

// The per-product camera block: the authored distance limits, each side
// optional, the minimum below the maximum when both are authored.
export const productCameraSchema = z
  .strictObject({
    minDistance: z.optional(z.number().check(z.positive())),
    maxDistance: z.optional(z.number().check(z.positive())),
  })
  .check(
    z.superRefine((camera, ctx) => {
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
    }),
  )

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
  .check(
    z.minLength(FINISHES_MIN, { error: `a product needs at least ${FINISHES_MIN} finish` }),
    z.superRefine(rejectDuplicateFinishValues('variant')),
    z.superRefine(rejectDuplicateFinishValues('label')),
  )

const hotspotsSchema = z.array(hotspotSchema).check(
  z.superRefine((hotspots, ctx) =>
    rejectDuplicates(
      hotspots,
      'id',
      (hotspot) => hotspot.id,
      (value) => `duplicate hotspot id '${value}'`,
      ctx,
    ),
  ),
  z.superRefine(rejectReservedHotspotIds),
)

// The per-product look: what the author wrote, with no defaults filled in.
// Every field is optional and the block is strict, so the resolution layer
// owns the fallbacks and a typo never passes silently.
export const productLookSchema = z.strictObject({
  exposure: z.optional(
    z
      .number()
      .check(
        z.positive({ error: 'expected a number greater than 0' }),
        z.maximum(LOOK_EXPOSURE_MAX, { error: `expected a number at most ${LOOK_EXPOSURE_MAX}` }),
      ),
  ),
  environmentIntensity: z.optional(
    z.number().check(
      z.minimum(0, { error: 'expected a number of at least 0' }),
      z.maximum(LOOK_ENVIRONMENT_INTENSITY_MAX, {
        error: `expected a number at most ${LOOK_ENVIRONMENT_INTENSITY_MAX}`,
      }),
    ),
  ),
  environmentRotationDeg: z.optional(
    z.number().check(
      z.minimum(0, { error: 'expected a number of at least 0' }),
      z.lt(LOOK_ENVIRONMENT_ROTATION_DEG_MAX, {
        error: `expected a number below ${LOOK_ENVIRONMENT_ROTATION_DEG_MAX}`,
      }),
    ),
  ),
  shadowOpacity: z.optional(
    z.number().check(
      z.minimum(0, { error: 'expected a number of at least 0' }),
      z.maximum(LOOK_SHADOW_OPACITY_MAX, {
        error: `expected a number at most ${LOOK_SHADOW_OPACITY_MAX}`,
      }),
    ),
  ),
})

// The per-product link-preview block: the words a link preview shows that no
// manifest field spells the same way, the product kind as a link preview
// names it and the description sentence. Optional: a product without the
// block declares no link-preview copy of its own.
export const productMetaSchema = z.strictObject({
  kind: singleLineText,
  description: singleLineText,
})

export type ProductLookBlock = z.output<typeof productLookSchema>
export type ProductCameraBlock = z.output<typeof productCameraSchema>
export type ProductMetaBlock = z.output<typeof productMetaSchema>

// The single source of truth for what a product manifest is. Every object is
// strict, so an unknown key is an error and a typo never passes silently.
export const productManifestSchema = z.strictObject({
  slug: z.string().check(
    z.regex(SLUG_PATTERN, {
      error: 'expected lowercase kebab case: words of a-z and 0-9 separated by single hyphens',
    }),
  ),
  number: z.number().check(z.int(), z.positive()),
  category: singleLineText,
  brand: singleLineText,
  model: singleLineText,
  eyebrow: productEyebrowText,
  tagline: singleLineText,
  intro: z.array(singleLineText).check(z.maxLength(INTRO_MAX_LINES)),
  finishes: finishesSchema,
  hotspots: hotspotsSchema,
  // Normalized with prefault, not defaulted: a parsed product always
  // carries the block, so every reader of explode.clip can trust the clip
  // name without repeating the default. The input keeps the block optional.
  explode: z.prefault(explodeSchema, {}),
  camera: z.optional(productCameraSchema),
  // Unlike explode, the look block keeps what the author wrote: the
  // resolution layer fills the defaults, because its own defaults are
  // viewer config, not schema data.
  look: z.optional(productLookSchema),
  meta: z.optional(productMetaSchema),
})

export type ProductInput = z.input<typeof productManifestSchema>
export type Product = z.output<typeof productManifestSchema>
