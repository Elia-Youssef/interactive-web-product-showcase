// The per-run report: file sizes and the texture sizes by image, against
// the per-product budgets of scripts/budgets.ts. Enforcement is the
// validate step's job; this report makes every run show what it produced.
import { stat } from 'node:fs/promises'
import type { Document, Material, Texture } from '@gltf-transform/core'
import { MODEL_BUDGET_BYTES } from './budgets.ts'
import { isMissingFileError } from './fsErrors.ts'
import { formatKtxVersion, type KtxResolution } from './ktxSoftware.ts'
import { textureSizeRule, type TextureSizeRule } from './pipeline.ts'
import type { OptimizeSettings } from './settings.ts'

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
  // The size setting the texture is encoded with, from the pipeline's stage
  // order.
  sizeRule: TextureSizeRule
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

// The standard texture slots, named as the gltf-transform CLI names them,
// with their accessors.
const SLOT_ACCESSORS = [
  ['baseColorTexture', (material: Material) => material.getBaseColorTexture()],
  ['metallicRoughnessTexture', (material: Material) => material.getMetallicRoughnessTexture()],
  ['normalTexture', (material: Material) => material.getNormalTexture()],
  ['occlusionTexture', (material: Material) => material.getOcclusionTexture()],
  ['emissiveTexture', (material: Material) => material.getEmissiveTexture()],
] as const

// Groups the slot names by texture across every material: one texture can
// ride in several slots, which decides which encode stage claims it.
export function slotsByTexture(doc: Document): Map<Texture, readonly string[]> {
  const slots = new Map<Texture, string[]>()
  for (const material of doc.getRoot().listMaterials()) {
    for (const [name, getTexture] of SLOT_ACCESSORS) {
      const texture = getTexture(material)
      if (texture === null) {
        continue
      }
      const used = slots.get(texture) ?? []
      if (!used.includes(name)) {
        used.push(name)
      }
      slots.set(texture, used)
    }
  }
  return slots
}

function describeTexture(
  texture: Texture,
  index: number,
  total: number,
  slots: readonly string[],
): TextureReport {
  const image = texture.getImage()
  return {
    label: texture.getURI() || texture.getName() || `texture ${index + 1}/${total}`,
    mimeType: texture.getMimeType(),
    dimensions: texture.getSize(),
    sizeBytes: image === null ? 0 : image.byteLength,
    slots,
    sizeRule: textureSizeRule(slots),
  }
}

export function describeTextures(doc: Document): TextureReport[] {
  const textures = doc.getRoot().listTextures()
  const slots = slotsByTexture(doc)
  return textures.map((texture, index) =>
    describeTexture(texture, index, textures.length, slots.get(texture) ?? []),
  )
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

// The share of the budget a file uses, in percent, rounded for display.
export function budgetShare(bytes: number): string {
  return `${((bytes / MODEL_BUDGET_BYTES) * 100).toFixed(1)}%`
}

// One report line per texture, naming its slots and the size rule it is
// encoded with. A texture the occlusion slot shares with another slot is
// stated with the rule it actually got, so the occlusion override can never
// silently miss it.
export function formatTextureLine(
  texture: TextureReport,
  settings: Pick<OptimizeSettings, 'textureMaxSize' | 'occlusionTextureMaxSize'>,
): string {
  const dimensions =
    texture.dimensions === null ? '?' : `${texture.dimensions[0]}x${texture.dimensions[1]}`
  const sizePx =
    texture.sizeRule === 'occlusionTextureMaxSize'
      ? settings.occlusionTextureMaxSize
      : settings.textureMaxSize
  let line =
    `${texture.label}: ${texture.mimeType}, ${dimensions}, ${formatBytes(texture.sizeBytes)}, ` +
    `slots: ${texture.slots.join(', ') || 'none'}, ` +
    `encoded at ${texture.sizeRule} (${sizePx} px)`
  if (texture.slots.includes('occlusionTexture') && texture.slots.length > 1) {
    line +=
      `, shared with the occlusion slot: ` +
      `occlusionTextureMaxSize (${settings.occlusionTextureMaxSize} px) does not apply`
  }
  return line
}
