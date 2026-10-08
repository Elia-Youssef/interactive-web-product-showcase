// The typed, validated settings of the optimize step. The schema is the
// single source of truth: the defaults are produced by it, and the optional
// per-product override (assets/blender/<slug>/pipeline.json) is validated
// against a pick of the same fields, so the override surface stays exactly
// as small as the schema says.
//
// The structure flags: no flatten, join, simplify, palette or prune,
// because the defaults of `optimize` silently delete HS_ empties, merge
// meshes and cut variant mappings. KTX2 is always requested explicitly
// and geometry always leaves as Meshopt.
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { issuesFromZod } from '../src/lib/validation.ts'
import { isMissingFileError } from './fsErrors.ts'
import { TEXTURE_MAX_SIZE_PX } from './budgets.ts'

export type SettingsIssue = {
  path: string
  message: string
}

function formatIssueLine(issue: SettingsIssue): string {
  return `- ${issue.path}: ${issue.message}`
}

// Names the settings source (built-in defaults or the override file) and
// every failing field, so invalid settings never pass silently.
export class SettingsError extends Error {
  readonly source: string
  readonly issues: readonly SettingsIssue[]

  constructor(source: string, issues: readonly SettingsIssue[]) {
    super(`Invalid optimize settings in '${source}':\n${issues.map(formatIssueLine).join('\n')}`)
    this.name = 'SettingsError'
    this.source = source
    this.issues = issues
  }
}

// KTX2 needs block-aligned textures; the encoder rounds a limit up, so the
// limit itself may be any positive integer. 16384 is the largest size any
// current GPU samples.
const TEXTURE_SIZE_MIN = 4
const TEXTURE_SIZE_MAX = 16384

const textureSize = z
  .number()
  .int()
  .min(TEXTURE_SIZE_MIN, { error: `expected at least ${TEXTURE_SIZE_MIN}` })
  .max(TEXTURE_SIZE_MAX, { error: `expected at most ${TEXTURE_SIZE_MAX}` })

// The project's encoding decision for the KTX2 stages, as fixed literals so
// no override or code path can move it. The values match gltf-transform
// 4.5.1's own optimize KTX2 settings, verified in the CLI source (cli.mjs):
// UASTC level 4 with RDO on and RDO lambda 4 for the data textures, ETC1S
// quality 255 for the color textures.
const uastcLevel = z.literal(4)
const uastcRdo = z.literal(true)
const uastcRdoLambda = z.literal(4)
// RDO multithreading trades determinism for a slight compression gain:
// KTX-Software's own help for --uastc-rdo-m says disabling it gives
// "slightly higher compression, deterministic", and gltf-transform 4.5.1
// leaves it on by default unless this flag is passed. The optimize step
// must give the same bytes for the same input, so off is the only value.
const uastcRdoMultithreading = z.literal(false)
// The zstd supercompression applied to UASTC textures: gltf-transform
// 4.5.1's optimize KTX2 default (UASTC_DEFAULTS.zstd in cli.mjs), passed to
// ktx as --zstd. ETC1S (BasisLZ) cannot take zstd, so this is UASTC-only.
const uastcZstd = z.literal(18)
const etc1sQuality = z.literal(255)
// The thread count of every ktx encode. KTX-Software 4.4.2's UASTC encode
// with RDO is only byte-stable single-threaded: threaded encodes produced
// two different outputs for the same input across runs, with RDO
// multithreading already off. gltf-transform 4.5.1 always passes at least
// two threads (Math.max(2, ...) in cli.mjs) and offers no switch, which is
// why the encode stage calls ktx directly. One is the only value that
// gives the same bytes for the same input.
const ktxThreads = z.literal(1)
// The size of the pool of concurrent ktx processes that executes the encode
// plan. Every process encodes one texture with ktxThreads and its output
// depends only on its own input, so the pool size cannot change any byte;
// it only overlaps the long single-threaded RDO encodes. Four keeps the
// peak memory of the pool (source image plus encoder per process) bounded
// while the encodes run.
const ktxJobs = z.literal(4)

// The geometry storage the pipeline fixes, as the gltf-transform CLI's own
// defaults it runs the geometry stage with (`optimize` quantizes with
// QUANTIZE_DEFAULTS and compresses with the meshopt writer's per-target
// filters): positions at 14 quantize bits, which stores a normalized Int16
// accessor, and animation translation outputs through the EXPONENTIAL
// filter at 12 bits. The contract's storage bounds are derived from these
// two numbers (storageBounds.ts), and the validate step holds every file
// against what they imply (contractRuleModel.ts), so an optimize change
// that moved either fails the gate instead of silently invalidating the
// allowance.
export const POSITION_QUANTIZE_BITS = 14
export const KEY_FILTER_BITS = 12

// The full settings of one optimize run. Every field is required: the
// defaults below are the base, and the file override is a partial pick.
export const optimizeSettingsSchema = z.strictObject({
  flatten: z.boolean(),
  join: z.boolean(),
  simplify: z.boolean(),
  palette: z.boolean(),
  prune: z.boolean(),
  compress: z.literal('meshopt'),
  textureFormat: z.literal('ktx2'),
  uastcLevel,
  uastcRdo,
  uastcRdoMultithreading,
  uastcRdoLambda,
  uastcZstd,
  etc1sQuality,
  ktxThreads,
  ktxJobs,
  textureMaxSize: textureSize,
  occlusionTextureMaxSize: textureSize,
})

export type OptimizeSettings = z.output<typeof optimizeSettingsSchema>

// The per-product override file. Deliberately a pick of the size fields
// only: the structure flags are the Blender contract and the
// encoder parameters are the project's encoding decision, so neither is a
// per-product tunable.
export const optimizeSettingsOverrideSchema = optimizeSettingsSchema
  .pick({ textureMaxSize: true, occlusionTextureMaxSize: true })
  .partial()

export type OptimizeSettingsOverride = z.output<typeof optimizeSettingsOverrideSchema>

const DEFAULTS_SOURCE = 'built-in defaults'

// Merges an override over the defaults and validates the result with the
// same rules the defaults themselves go through. The occlusion size falls
// back to the maximum texture size, never to a second constant.
export function resolveOptimizeSettings(override: unknown, source: string): OptimizeSettings {
  const parsed = optimizeSettingsOverrideSchema.safeParse(override)
  if (!parsed.success) {
    throw new SettingsError(source, issuesFromZod(parsed.error.issues))
  }
  const textureMaxSize = parsed.data.textureMaxSize ?? DEFAULT_TEXTURE_MAX_SIZE
  const occlusionTextureMaxSize = parsed.data.occlusionTextureMaxSize ?? textureMaxSize
  if (occlusionTextureMaxSize > textureMaxSize) {
    throw new SettingsError(source, [
      {
        path: 'occlusionTextureMaxSize',
        message: `expected at most textureMaxSize (${textureMaxSize})`,
      },
    ])
  }
  return { ...FIXED_DEFAULTS, textureMaxSize, occlusionTextureMaxSize }
}

// The flag set that keeps HS_ empties, parts
// and variant mappings, with Meshopt geometry and explicit KTX2 textures.
// The encoder fields are the fixed encoding decision documented above.
const FIXED_DEFAULTS = {
  flatten: false,
  join: false,
  simplify: false,
  palette: false,
  prune: false,
  compress: 'meshopt',
  textureFormat: 'ktx2',
  uastcLevel: 4,
  uastcRdo: true,
  uastcRdoMultithreading: false,
  uastcRdoLambda: 4,
  uastcZstd: 18,
  etc1sQuality: 255,
  ktxThreads: 1,
  ktxJobs: 4,
} satisfies Partial<OptimizeSettings>

const DEFAULT_TEXTURE_MAX_SIZE = TEXTURE_MAX_SIZE_PX

// The defaults are produced by the same resolver as every override, so a
// bad edit to them fails at import time, not in a product run.
export const DEFAULT_OPTIMIZE_SETTINGS: OptimizeSettings = resolveOptimizeSettings(
  {},
  DEFAULTS_SOURCE,
)

// Reads and validates an optional per-product override file. A missing file
// is the normal case and yields the defaults; a broken one fails loudly,
// naming the file and the field. The result says whether an override file
// was applied, so the run report can name it.
export async function loadOptimizeSettings(
  settingsFile: string,
): Promise<{ settings: OptimizeSettings; usedOverride: boolean }> {
  let contents: string
  try {
    contents = await readFile(settingsFile, 'utf8')
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return { settings: DEFAULT_OPTIMIZE_SETTINGS, usedOverride: false }
  }
  let raw: unknown
  try {
    raw = JSON.parse(contents)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SettingsError(settingsFile, [
      { path: '', message: `expected valid JSON: ${message}` },
    ])
  }
  return { settings: resolveOptimizeSettings(raw, settingsFile), usedOverride: true }
}
