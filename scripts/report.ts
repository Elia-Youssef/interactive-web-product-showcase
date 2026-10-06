// The per-run report: file sizes and the texture sizes by image, against
// the per-product budgets of scripts/budgets.ts. Enforcement is the
// validate step's job; this report makes every run show what it produced.
// The size rule of a texture comes from the encode plan the run executed,
// so the report and the encoder share one rule.
import { stat } from 'node:fs/promises'
import type { Document } from '@gltf-transform/core'
import { listTextureSlots } from '@gltf-transform/functions'
import { MODEL_BUDGET_BYTES } from './budgets.ts'
import { isMissingFileError } from './fsErrors.ts'
import { formatKtxVersion, type KtxResolution } from './ktxSoftware.ts'
import type { EncodePlan, EncodeStage, TextureSizeRule } from './ktx2Plan.ts'
import type { OptimizeSettings } from './settings.ts'
import type { TangentReport } from './tangents.ts'

// The one run-report line for the resolved install: the version printed
// once, parsed and rendered, never the raw multiword tool output.
export function formatKtxResolutionLine(resolution: KtxResolution): string {
  return (
    `ktx: KTX-Software ${formatKtxVersion(resolution.version)} ` +
    `from '${resolution.folder}' (${resolution.source})`
  )
}

export type TextureReport = {
  label: string
  mimeType: string
  // Width and height in pixels, or null when the dimensions are unreadable.
  dimensions: readonly [number, number] | null
  sizeBytes: number
  // Every slot that references the texture, named as the CLI names them.
  slots: readonly string[]
  // The claiming stage and size rule of the encode plan, or null when the
  // run did not encode the texture because it was already KTX2.
  stage: EncodeStage | null
  sizeRule: TextureSizeRule | null
}

export type ModelReport = {
  fileBytes: number
  textures: readonly TextureReport[]
}

// Returns null when the file does not exist, so a missing input is a
// caller-level error with context, not a stack trace from stat. Every other
// error propagates.
export async function fileSizeBytes(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).size
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return null
  }
}

// Describes every texture of a document. With an encode plan, the document
// must be the one the plan was built over and executed on: the plan's
// entries are keyed by that document's texture positions. The written file
// is not that document, since the CLI's geometry pass merges identical
// textures first and shifts the positions after them, so the pipeline
// describes the run's textures itself (pipeline.ts). The slots are read
// with the plan's own slot rule, so every slot the encoder saw, extension
// slots included, is the slot the report names.
export function describeTextures(doc: Document, plan?: EncodePlan): TextureReport[] {
  const textures = doc.getRoot().listTextures()
  return textures.map((texture, index) => {
    const entry = plan?.entries.find((candidate) => candidate.textureIndex === index)
    const image = texture.getImage()
    return {
      label: texture.getURI() || texture.getName() || `texture ${index + 1}/${textures.length}`,
      mimeType: texture.getMimeType(),
      dimensions: texture.getSize(),
      sizeBytes: image === null ? 0 : image.byteLength,
      slots: listTextureSlots(texture),
      stage: entry?.stage ?? null,
      sizeRule: entry?.sizeRule ?? null,
    }
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toFixed(2)} ${units[unit] ?? 'GB'}`
}

// The one run-report line for the tangent stage: how many primitives lost
// TANGENT, out of those that carried one into the stage, and the
// uncompressed accessor bytes the stage removed from the document the
// pipeline writes.
export function formatTangentLine(report: TangentReport): string {
  return (
    `tangents: ${report.primitivesStripped} of ` +
    `${report.primitivesStripped + report.primitivesKept} primitives stripped, ` +
    `${formatBytes(report.accessorBytesRemoved)} of tangent accessors removed`
  )
}

// The share of the budget a file uses, in percent, rounded for display.
export function budgetShare(bytes: number): string {
  return `${((bytes / MODEL_BUDGET_BYTES) * 100).toFixed(1)}%`
}

// One report line per texture, naming its slots and the claiming stage and
// size rule of the plan the run executed. A texture with the occlusion slot
// whose plan size rule is not the override (another stage claimed it first)
// states that the override does not apply to it, so the occlusion override
// can never silently miss; one the plan encodes at the override carries no
// such note, whatever other slots it shares.
export function formatTextureLine(
  texture: TextureReport,
  settings: Pick<OptimizeSettings, 'textureMaxSize' | 'occlusionTextureMaxSize'>,
): string {
  const dimensions =
    texture.dimensions === null ? '?' : `${texture.dimensions[0]}x${texture.dimensions[1]}`
  let line =
    `${texture.label}: ${texture.mimeType}, ${dimensions}, ${formatBytes(texture.sizeBytes)}, ` +
    `slots: ${texture.slots.join(', ') || 'none'}`
  if (texture.stage === null || texture.sizeRule === null) {
    line += ', already KTX2'
    return line
  }
  const sizePx =
    texture.sizeRule === 'occlusionTextureMaxSize'
      ? settings.occlusionTextureMaxSize
      : settings.textureMaxSize
  line += `, encoded by the ${texture.stage} stage at ${texture.sizeRule} (${sizePx} px)`
  if (
    texture.slots.includes('occlusionTexture') &&
    texture.sizeRule !== 'occlusionTextureMaxSize'
  ) {
    line +=
      `, shared with the occlusion slot: ` +
      `occlusionTextureMaxSize (${settings.occlusionTextureMaxSize} px) does not apply`
  }
  return line
}
