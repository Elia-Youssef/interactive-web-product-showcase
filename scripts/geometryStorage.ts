// The geometry storage the optimize step writes, held in one data file that
// every reader of those numbers shares (assets/blender/geometry-storage.json):
// positions quantized to positionQuantizeBits, which stores a normalized
// Int16 accessor above 8 bits, and animation translation keys through the
// meshopt EXPONENTIAL filter at translationKeyFilterBits. The numbers are
// gltf-transform's own, not choices: the geometry stage runs the CLI's
// optimize, which quantizes with the meshopt transform's defaults and
// filters keys in the meshopt writer, and geometryStorage.test.ts holds the
// file against both. The validate step reads the file through settings.ts;
// the authoring side reads the same file for the storage shift its home
// camera fit folds into the margin, so the two sides cannot state
// different storage.
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { issuesFromZod, type ValidationIssue } from '../src/lib/validation.ts'

export const GEOMETRY_STORAGE_FILE = fileURLToPath(
  new URL('../assets/blender/geometry-storage.json', import.meta.url),
)

export const geometryStorageSchema = z.strictObject({
  // gltf-transform's quantize takes 8 to 16 position bits.
  positionQuantizeBits: z.number().int().min(8).max(16),
  // The meshopt EXPONENTIAL filter takes 1 to 24 mantissa bits.
  translationKeyFilterBits: z.number().int().min(1).max(24),
})

export type GeometryStorage = z.output<typeof geometryStorageSchema>

// The parsed file, or every issue that makes it no geometry storage. The
// caller names the file in its error, the way the override files are named.
export function geometryStorageOf(
  raw: unknown,
):
  | { readonly kind: 'valid'; readonly storage: GeometryStorage }
  | { readonly kind: 'invalid'; readonly issues: readonly ValidationIssue[] } {
  const parsed = geometryStorageSchema.safeParse(raw)
  return parsed.success
    ? { kind: 'valid', storage: parsed.data }
    : { kind: 'invalid', issues: issuesFromZod(parsed.error.issues) }
}
