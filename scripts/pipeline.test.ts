import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from './settings.ts'
import {
  buildEtc1sStageArgs,
  buildGeometryStageArgs,
  buildUastcStageArgs,
  runOptimizePipeline,
  textureSizeRule,
  type CliRunner,
} from './pipeline.ts'

const settingsWith = (overrides: Partial<OptimizeSettings>): OptimizeSettings => ({
  ...DEFAULT_OPTIMIZE_SETTINGS,
  ...overrides,
})

describe('buildGeometryStageArgs', () => {
  it('carries the structure flags with texture work already done', () => {
    expect(buildGeometryStageArgs('in.glb', 'out.glb', DEFAULT_OPTIMIZE_SETTINGS)).toEqual([
      'optimize',
      'in.glb',
      'out.glb',
      '--flatten=false',
      '--join=false',
      '--simplify=false',
      '--palette=false',
      '--prune=false',
      '--texture-compress=false',
      '--compress=meshopt',
    ])
  })

  it('reflects a setting that turns pruning on', () => {
    const args = buildGeometryStageArgs('in.glb', 'out.glb', settingsWith({ prune: true }))
    expect(args).toContain('--prune=true')
  })
})

describe('buildUastcStageArgs', () => {
  it('emits the encoder parameters from the settings object it is passed', () => {
    const settings = DEFAULT_OPTIMIZE_SETTINGS
    const args = buildUastcStageArgs(
      'in.glb',
      'out.glb',
      '{normalTexture,metallicRoughnessTexture}',
      settings.textureMaxSize,
      settings,
    )
    expect(args).toEqual([
      'uastc',
      'in.glb',
      'out.glb',
      '--slots={normalTexture,metallicRoughnessTexture}',
      `--resize=${settings.textureMaxSize}`,
      `--level=${settings.uastcLevel}`,
      `--rdo=${settings.uastcRdo}`,
      `--rdo-lambda=${settings.uastcRdoLambda}`,
    ])
  })
})

describe('buildEtc1sStageArgs', () => {
  it('emits the quality from the settings object it is passed', () => {
    const settings = DEFAULT_OPTIMIZE_SETTINGS
    expect(buildEtc1sStageArgs('in.glb', 'out.glb', settings.textureMaxSize, settings)).toEqual([
      'etc1s',
      'in.glb',
      'out.glb',
      `--resize=${settings.textureMaxSize}`,
      `--quality=${settings.etc1sQuality}`,
    ])
  })
})

describe('textureSizeRule', () => {
  it('gives a texture only the occlusion slot uses the occlusion override', () => {
    expect(textureSizeRule(['occlusionTexture'])).toBe('occlusionTextureMaxSize')
  })

  it('encodes a texture shared with the occlusion slot at the maximum', () => {
    expect(textureSizeRule(['normalTexture', 'occlusionTexture'])).toBe('textureMaxSize')
    expect(textureSizeRule(['occlusionTexture', 'metallicRoughnessTexture'])).toBe('textureMaxSize')
  })

  it('keeps every other texture at the maximum', () => {
    expect(textureSizeRule(['baseColorTexture'])).toBe('textureMaxSize')
    expect(textureSizeRule([])).toBe('textureMaxSize')
  })
})

describe('runOptimizePipeline', () => {
  const recordedRunner = (): { run: CliRunner; calls: string[][] } => {
    const calls: string[][] = []
    const run: CliRunner = async (args) => {
      calls.push([...args])
      return undefined
    }
    return { run, calls }
  }

  it('chains three texture passes and the geometry pass to the output path', async () => {
    const { run, calls } = recordedRunner()
    await runOptimizePipeline({
      inputPath: 'raw.glb',
      outputPath: 'out/model.glb',
      settings: settingsWith({ occlusionTextureMaxSize: 512 }),
      run,
    })
    expect(calls).toHaveLength(4)
    const [data, occlusion, color, geometry] = calls
    expect(data?.[0]).toBe('uastc')
    expect(data?.[1]).toBe('raw.glb')
    expect(data?.[2]).toMatch(/stage1-data-uastc\.glb$/)
    expect(data).toContain('--slots={normalTexture,metallicRoughnessTexture}')
    expect(data).toContain('--resize=2048')
    expect(occlusion?.[0]).toBe('uastc')
    expect(occlusion?.[1]).toBe(data?.[2])
    expect(occlusion?.[2]).toMatch(/stage2-occlusion-uastc\.glb$/)
    expect(occlusion).toContain('--slots=occlusionTexture')
    expect(occlusion).toContain('--resize=512')
    expect(color?.[0]).toBe('etc1s')
    expect(color?.[1]).toBe(occlusion?.[2])
    expect(color?.[2]).toMatch(/stage3-color-etc1s\.glb$/)
    expect(color).toContain('--resize=2048')
    expect(geometry?.[0]).toBe('optimize')
    expect(geometry?.[1]).toBe(color?.[2])
    expect(geometry?.[2]).toBe('out/model.glb')
  })

  it('carries the encoder parameters of its settings into every texture pass', async () => {
    const { run, calls } = recordedRunner()
    await runOptimizePipeline({
      inputPath: 'raw.glb',
      outputPath: 'out/model.glb',
      settings: DEFAULT_OPTIMIZE_SETTINGS,
      run,
    })
    const [data, , color] = calls
    expect(data).toContain(`--level=${DEFAULT_OPTIMIZE_SETTINGS.uastcLevel}`)
    expect(data).toContain(`--rdo=${DEFAULT_OPTIMIZE_SETTINGS.uastcRdo}`)
    expect(data).toContain(`--rdo-lambda=${DEFAULT_OPTIMIZE_SETTINGS.uastcRdoLambda}`)
    expect(color).toContain(`--quality=${DEFAULT_OPTIMIZE_SETTINGS.etc1sQuality}`)
  })
})
