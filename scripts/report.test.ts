// The report's texture facts, its per-texture line, and the file size read
// that only swallows a missing file, never another error.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Document } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from './settings.ts'
import {
  describeTextures,
  fileSizeBytes,
  formatKtxResolutionLine,
  formatTextureLine,
} from './report.ts'

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

function docWithSharedTextures(): Document {
  const doc = new Document()
  // One packed occlusion-roughness-metallic texture: the occlusion slot
  // shares it with a UASTC data slot, so the occlusion override misses it.
  const packed = doc.createTexture('packed-orm')
  const aoOnly = doc.createTexture('ao-only')
  const color = doc.createTexture('base-color')
  const withPacked = doc.createMaterial('with-packed')
  withPacked.setNormalTexture(packed)
  withPacked.setOcclusionTexture(packed)
  const withSeparate = doc.createMaterial('with-separate')
  withSeparate.setOcclusionTexture(aoOnly)
  withSeparate.setBaseColorTexture(color)
  return doc
}

describe('describeTextures', () => {
  it('reports every texture with its slots and its size rule', () => {
    const doc = docWithSharedTextures()
    const reports = describeTextures(doc)
    const byLabel = new Map(reports.map((report) => [report.label, report]))
    const packed = byLabel.get('packed-orm')
    expect(packed?.slots).toEqual(['normalTexture', 'occlusionTexture'])
    expect(packed?.sizeRule).toBe('textureMaxSize')
    const aoOnly = byLabel.get('ao-only')
    expect(aoOnly?.slots).toEqual(['occlusionTexture'])
    expect(aoOnly?.sizeRule).toBe('occlusionTextureMaxSize')
    const color = byLabel.get('base-color')
    expect(color?.slots).toEqual(['baseColorTexture'])
    expect(color?.sizeRule).toBe('textureMaxSize')
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
  it('states the slots and the size rule of an occlusion-only texture', () => {
    const line = formatTextureLine(
      {
        label: 'ao-only',
        mimeType: 'image/ktx2',
        dimensions: [1024, 1024],
        sizeBytes: 2048,
        slots: ['occlusionTexture'],
        sizeRule: 'occlusionTextureMaxSize',
      },
      settingsWith({ occlusionTextureMaxSize: 512 }),
    )
    expect(line).toContain('ao-only: image/ktx2, 1024x1024, 2.00 KB')
    expect(line).toContain('slots: occlusionTexture')
    expect(line).toContain('encoded at occlusionTextureMaxSize (512 px)')
    expect(line).not.toContain('shared')
  })

  it('names a texture shared with the occlusion slot and the rule it got', () => {
    const line = formatTextureLine(
      {
        label: 'packed-orm',
        mimeType: 'image/ktx2',
        dimensions: [2048, 2048],
        sizeBytes: 4096,
        slots: ['normalTexture', 'occlusionTexture'],
        sizeRule: 'textureMaxSize',
      },
      settingsWith({ occlusionTextureMaxSize: 512 }),
    )
    expect(line).toContain('packed-orm: image/ktx2, 2048x2048, 4.00 KB')
    expect(line).toContain('slots: normalTexture, occlusionTexture')
    expect(line).toContain('encoded at textureMaxSize (2048 px)')
    expect(line).toContain('shared with the occlusion slot')
    expect(line).toContain('occlusionTextureMaxSize (512 px) does not apply')
  })
})
