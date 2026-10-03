// The report's texture facts, its per-texture line, and the file size read
// that only swallows a missing file, never another error.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildEncodePlan } from './ktx2Plan.ts'
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from './settings.ts'
import {
  describeTextures,
  fileSizeBytes,
  formatKtxResolutionLine,
  formatTextureLine,
} from './report.ts'
import { docWithTextures } from './texture.fixtures.ts'

describe('formatKtxResolutionLine', () => {
  it('prints the parsed version once, not the raw tool output', () => {
    const line = formatKtxResolutionLine({
      folder: 'C:\\Program Files\\KTX-Software\\bin',
      version: { major: 4, minor: 4, patch: 2 },
      source: 'default',
    })
    expect(line).toBe(
      "ktx: KTX-Software 4.4.2 from 'C:\\Program Files\\KTX-Software\\bin' (default)",
    )
    expect(line).not.toContain('ktx version:')
  })
})

const settingsWith = (overrides: Partial<OptimizeSettings>): OptimizeSettings => ({
  ...DEFAULT_OPTIMIZE_SETTINGS,
  ...overrides,
})

describe('describeTextures', () => {
  it('reports every texture with the claiming stage and size rule of the plan', () => {
    const doc = docWithTextures([
      // One packed occlusion-roughness-metallic texture: the data stage
      // claims it before the occlusion stage can, so the override misses it.
      { name: 'packed-orm', slots: ['normalTexture', 'occlusionTexture'] },
      { name: 'ao-only', slots: ['occlusionTexture'] },
      { name: 'base-color', slots: ['baseColorTexture'] },
      // A texture the run did not encode because it was already KTX2.
      { name: 'passthrough', slots: ['occlusionTexture'] },
    ])
    doc
      .getRoot()
      .listTextures()
      .find((texture) => texture.getName() === 'passthrough')
      ?.setMimeType('image/ktx2')
    const plan = buildEncodePlan(doc, settingsWith({ occlusionTextureMaxSize: 512 }))
    const reports = describeTextures(doc, plan)
    const byLabel = new Map(reports.map((report) => [report.label, report]))
    const packed = byLabel.get('packed-orm')
    expect(packed?.slots).toEqual(['normalTexture', 'occlusionTexture'])
    expect(packed?.stage).toBe('data')
    expect(packed?.sizeRule).toBe('textureMaxSize')
    const aoOnly = byLabel.get('ao-only')
    expect(aoOnly?.slots).toEqual(['occlusionTexture'])
    expect(aoOnly?.stage).toBe('occlusion')
    expect(aoOnly?.sizeRule).toBe('occlusionTextureMaxSize')
    const color = byLabel.get('base-color')
    expect(color?.slots).toEqual(['baseColorTexture'])
    expect(color?.stage).toBe('color')
    expect(color?.sizeRule).toBe('textureMaxSize')
    const passthrough = byLabel.get('passthrough')
    expect(passthrough?.stage).toBeNull()
    expect(passthrough?.sizeRule).toBeNull()
  })
})

describe('fileSizeBytes', () => {
  let tempDir = ''
  let filePath = ''

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'report-test-'))
    filePath = path.join(tempDir, 'present.bin')
    await writeFile(filePath, '12345')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns the size of a present file', async () => {
    await expect(fileSizeBytes(filePath)).resolves.toBe(5)
  })

  it('returns null for a missing file', async () => {
    await expect(fileSizeBytes(path.join(tempDir, 'missing.bin'))).resolves.toBeNull()
  })

  it('propagates an error that is not a missing file', async () => {
    // A path Node rejects outright: never a missing file, so never null.
    await expect(fileSizeBytes('bad\0path.bin')).rejects.toThrow()
  })
})

describe('formatTextureLine', () => {
  it('states the slots, the claiming stage and the size rule of the plan', () => {
    const line = formatTextureLine(
      {
        label: 'ao-only',
        mimeType: 'image/ktx2',
        dimensions: [1024, 1024],
        sizeBytes: 2048,
        slots: ['occlusionTexture'],
        stage: 'occlusion',
        sizeRule: 'occlusionTextureMaxSize',
      },
      settingsWith({ occlusionTextureMaxSize: 512 }),
    )
    expect(line).toContain('ao-only: image/ktx2, 1024x1024, 2.00 KB')
    expect(line).toContain('slots: occlusionTexture')
    expect(line).toContain('encoded by the occlusion stage at occlusionTextureMaxSize (512 px)')
    expect(line).not.toContain('shared')
  })

  it('names a texture the data stage claimed and states that the override misses it', () => {
    const line = formatTextureLine(
      {
        label: 'packed-orm',
        mimeType: 'image/ktx2',
        dimensions: [2048, 2048],
        sizeBytes: 4096,
        slots: ['normalTexture', 'occlusionTexture'],
        stage: 'data',
        sizeRule: 'textureMaxSize',
      },
      settingsWith({ occlusionTextureMaxSize: 512 }),
    )
    expect(line).toContain('packed-orm: image/ktx2, 2048x2048, 4.00 KB')
    expect(line).toContain('slots: normalTexture, occlusionTexture')
    expect(line).toContain('encoded by the data stage at textureMaxSize (2048 px)')
    expect(line).toContain('shared with the occlusion slot')
    expect(line).toContain('occlusionTextureMaxSize (512 px) does not apply')
  })

  it('states that a texture without a plan entry was already KTX2', () => {
    const line = formatTextureLine(
      {
        label: 'passthrough',
        mimeType: 'image/ktx2',
        dimensions: [1024, 1024],
        sizeBytes: 4096,
        slots: ['occlusionTexture'],
        stage: null,
        sizeRule: null,
      },
      settingsWith({ occlusionTextureMaxSize: 512 }),
    )
    expect(line).toContain('passthrough: image/ktx2, 1024x1024, 4.00 KB')
    expect(line).toContain('already KTX2')
    expect(line).not.toContain('encoded by')
  })
})
