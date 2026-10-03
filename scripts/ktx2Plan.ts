// The per-document KTX2 encode plan: a pure value computed from a Document
// and the optimize settings before anything runs.
//
// One entry per texture the run encodes, holding the stage that claims it,
// the bitstream mode, the encoded size, the color space, the channel mask,
// and the full ktx create argument list, with the input and output file
// names relative to the run's workspace. The claiming order is the
// pipeline's rule: the UASTC data stage first, then the UASTC occlusion
// stage, then the ETC1S color stage, which claims every texture the first
// two did not. A texture used by several slots is therefore encoded once,
// by the first stage whose slots cover it, and the claiming stage alone
// decides the size the report prints, so the encoder and the report share
// one rule.
import { ImageUtils, type Document, type Texture } from '@gltf-transform/core'
import {
  getTextureChannelMask,
  getTextureColorSpace,
  listTextureSlots,
} from '@gltf-transform/functions'
import { buildKtxCreateArgs, type Ktx2Mode, type TextureColorSpace } from './ktx2Args.ts'
import type { OptimizeSettings } from './settings.ts'

// Which size setting a texture is encoded with, decided by its claiming
// stage: only the occlusion stage applies the per-product override.
export type TextureSizeRule = 'textureMaxSize' | 'occlusionTextureMaxSize'

export type EncodeStage = 'data' | 'occlusion' | 'color'

// The slot selection of a stage, applied to every slot a texture is used
// in. The CLI matched slot globs with micromatch's nocase and contains
// options, which is a case-insensitive substring match, so the filters
// below are the same match written out for the literal slot names.
export type SlotFilter = (slots: readonly string[]) => boolean

function slotContains(slots: readonly string[], name: string): boolean {
  return slots.some((slot) => slot.toLowerCase().includes(name))
}

// The UASTC data stage: the slots the CLI's own optimize ktx2 path treats
// as data textures, matched like the glob
// '{normalTexture,metallicRoughnessTexture}'.
export const dataTextureSlots: SlotFilter = (slots) =>
  slotContains(slots, 'normaltexture') || slotContains(slots, 'metallicroughnesstexture')

// The UASTC occlusion stage: the single slot the per-product size override
// is about, matched like the glob 'occlusionTexture'.
export const occlusionSlot: SlotFilter = (slots) => slotContains(slots, 'occlusiontexture')

// The size rule of a claiming stage: only the occlusion stage applies the
// per-product override; the data and color stages encode at the maximum.
export function stageSizeRule(stage: EncodeStage): TextureSizeRule {
  return stage === 'occlusion' ? 'occlusionTextureMaxSize' : 'textureMaxSize'
}

function stageMode(stage: EncodeStage): Ktx2Mode {
  return stage === 'color' ? 'etc1s' : 'uastc'
}

function stageMaxSize(stage: EncodeStage, settings: OptimizeSettings): number {
  return stage === 'occlusion' ? settings.occlusionTextureMaxSize : settings.textureMaxSize
}

// The stage whose slots cover the texture, walked in the pipeline's order.
// The color stage has no slot filter, so it claims every texture that
// reaches it, as the CLI's standalone etc1s command did.
function claimingStage(slots: readonly string[]): EncodeStage {
  if (dataTextureSlots(slots)) {
    return 'data'
  }
  if (occlusionSlot(slots)) {
    return 'occlusion'
  }
  return 'color'
}

// The label the CLI logs for one texture: its URI, else its name, else its
// position (cli.mjs 620).
function textureLabel(texture: Texture, index: number, total: number): string {
  return texture.getURI() || texture.getName() || `texture ${index + 1}/${total}`
}

export type EncodePlanEntry = {
  // The texture's position in the document; also the key the report uses.
  textureIndex: number
  label: string
  stage: EncodeStage
  mode: Ktx2Mode
  sizeRule: TextureSizeRule
  maxSize: number
  colorSpace: TextureColorSpace
  channels: number
  srcSize: readonly [number, number]
  slots: readonly string[]
  // The source and target file names inside the run's workspace, unique by
  // texture index.
  sourceName: string
  targetName: string
  // The full ktx create arguments, ending with the two file names.
  arguments: readonly string[]
}

export type EncodePlan = {
  entries: readonly EncodePlanEntry[]
}

// Builds the plan for one document. A texture that is already KTX2 gets no
// entry and passes through untouched, as the CLI's stages skipped it. An
// unsupported source format or an unreadable image fails here, before any
// encode runs, where the CLI logged and skipped: a skipped texture would
// ship unoptimized and unrequested bytes.
export function buildEncodePlan(doc: Document, settings: OptimizeSettings): EncodePlan {
  const entries: EncodePlanEntry[] = []
  const textures = doc.getRoot().listTextures()
  for (const [textureIndex, texture] of textures.entries()) {
    const label = textureLabel(texture, textureIndex, textures.length)
    const mimeType = texture.getMimeType()
    if (mimeType === 'image/ktx2') {
      continue
    }
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
      throw new Error(
        `ktx2: ${label}: unsupported source format '${mimeType}'; ` +
          'the optimize step encodes PNG and JPEG textures only',
      )
    }
    const srcImage = texture.getImage()
    const srcSize = texture.getSize()
    // A png or jpeg source either parses or throws inside the image
    // utils; a null here means the texture carries no readable image.
    if (srcImage === null || srcSize === null) {
      throw new Error(`ktx2: ${label}: texture is unreadable and cannot be encoded`)
    }
    const slots = listTextureSlots(texture)
    const stage = claimingStage(slots)
    const mode = stageMode(stage)
    const maxSize = stageMaxSize(stage, settings)
    const colorSpace = getTextureColorSpace(texture)
    const channels = getTextureChannelMask(texture)
    const sourceName = `${textureIndex}.${ImageUtils.mimeTypeToExtension(mimeType)}`
    const targetName = `${textureIndex}.ktx2`
    entries.push({
      textureIndex,
      label,
      stage,
      mode,
      sizeRule: stageSizeRule(stage),
      maxSize,
      colorSpace,
      channels,
      srcSize,
      slots,
      sourceName,
      targetName,
      arguments: buildKtxCreateArgs(
        { mode, slots, colorSpace, channels, srcSize, maxSize, settings },
        sourceName,
        targetName,
      ),
    })
  }
  return { entries }
}
