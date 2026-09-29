// The optimize pipeline: the structure-preserving transforms plus explicit
// KTX2 encoding, driven through the gltf-transform CLI.
//
// The texture stage runs the CLI's own `optimize` ktx2 settings as three
// standalone passes, so the per-product occlusion size can be applied: the
// CLI's `optimize` command has a single global --texture-size, while the
// standalone `uastc`/`etc1s` commands take --slots and --resize. UASTC
// covers the data textures and ETC1S the color textures; the encoder
// parameters come from the settings, fixed to the CLI optimize ktx2 values
// (see settings.ts).
//
// The geometry stage then runs `optimize` with the structure flags and
// --texture-compress=false: the texture stage already encoded everything,
// so the geometry stage needs no KTX-Software at all.
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { OptimizeSettings } from './settings.ts'

// The slot globs of the CLI's own optimize ktx2 path (MICROMATCH_OPTIONS
// contains:true, so these match the same slots in the standalone commands).
// Brace expansion needs a comma, so the single-slot occlusion glob is
// written plain: '{occlusionTexture}' would match only the literal braces.
const SLOTS_DATA_TEXTURES = '{normalTexture,metallicRoughnessTexture}'
const SLOTS_OCCLUSION = 'occlusionTexture'

// Which size setting a texture is encoded with.
export type TextureSizeRule = 'textureMaxSize' | 'occlusionTextureMaxSize'

// The deliberate rule for textures used by several slots: a texture is
// encoded once, by the first stage whose slots cover it, so a texture
// shared between the occlusion slot and another UASTC slot is encoded at
// textureMaxSize, and the occlusion override applies only to a texture the
// occlusion slot alone uses. The run report names every shared texture with
// the rule it got, so the override can never silently miss.
export function textureSizeRule(slots: readonly string[]): TextureSizeRule {
  const occlusionOnly = slots.length === 1 && slots[0] === 'occlusionTexture'
  return occlusionOnly ? 'occlusionTextureMaxSize' : 'textureMaxSize'
}

// The runner the pipeline is parameterized by: one gltf-transform command.
// The real runner spawns the CLI; tests record the calls instead.
export type CliRunner = (args: readonly string[]) => Promise<unknown>

export function buildUastcStageArgs(
  inputPath: string,
  outputPath: string,
  slots: string,
  maxSize: number,
  settings: OptimizeSettings,
): string[] {
  return [
    'uastc',
    inputPath,
    outputPath,
    `--slots=${slots}`,
    `--resize=${maxSize}`,
    `--level=${settings.uastcLevel}`,
    `--rdo=${settings.uastcRdo}`,
    `--rdo-lambda=${settings.uastcRdoLambda}`,
  ]
}

export function buildEtc1sStageArgs(
  inputPath: string,
  outputPath: string,
  maxSize: number,
  settings: OptimizeSettings,
): string[] {
  return [
    'etc1s',
    inputPath,
    outputPath,
    `--resize=${maxSize}`,
    `--quality=${settings.etc1sQuality}`,
  ]
}

export function buildGeometryStageArgs(
  inputPath: string,
  outputPath: string,
  settings: OptimizeSettings,
): string[] {
  return [
    'optimize',
    inputPath,
    outputPath,
    `--flatten=${settings.flatten}`,
    `--join=${settings.join}`,
    `--simplify=${settings.simplify}`,
    `--palette=${settings.palette}`,
    `--prune=${settings.prune}`,
    '--texture-compress=false',
    `--compress=${settings.compress}`,
  ]
}

export type PipelineParams = {
  inputPath: string
  outputPath: string
  settings: OptimizeSettings
  run: CliRunner
}

// Runs the full pipeline on one product: three texture passes through a
// temporary folder, then the geometry pass straight to the output path,
// creating its folder. The temporary folder is removed even when a stage
// fails.
export async function runOptimizePipeline(params: PipelineParams): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'optimize-'))
  try {
    const afterDataTextures = path.join(tempDir, 'stage1-data-uastc.glb')
    const afterOcclusion = path.join(tempDir, 'stage2-occlusion-uastc.glb')
    const afterAllTextures = path.join(tempDir, 'stage3-color-etc1s.glb')
    await params.run(
      buildUastcStageArgs(
        params.inputPath,
        afterDataTextures,
        SLOTS_DATA_TEXTURES,
        params.settings.textureMaxSize,
        params.settings,
      ),
    )
    await params.run(
      buildUastcStageArgs(
        afterDataTextures,
        afterOcclusion,
        SLOTS_OCCLUSION,
        params.settings.occlusionTextureMaxSize,
        params.settings,
      ),
    )
    await params.run(
      buildEtc1sStageArgs(afterOcclusion, afterAllTextures, params.settings.textureMaxSize,
        params.settings),
    )
    await mkdir(path.dirname(params.outputPath), { recursive: true })
    await params.run(buildGeometryStageArgs(afterAllTextures, params.outputPath, params.settings))
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
