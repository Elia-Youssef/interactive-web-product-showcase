import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEXTURE_MAX_SIZE_PX } from './budgets.ts'
import {
  DEFAULT_OPTIMIZE_SETTINGS,
  optimizeSettingsSchema,
  SettingsError,
  loadOptimizeSettings,
  resolveOptimizeSettings,
  type OptimizeSettings,
} from './settings.ts'

describe('resolveOptimizeSettings', () => {
  it('produces the structure flags, the fixed encoder settings and the 2048 defaults', () => {
    expect(resolveOptimizeSettings({}, 'test')).toEqual({
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
      textureMaxSize: 2048,
      occlusionTextureMaxSize: 2048,
    })
  })

  it('applies a maximum texture size and falls the occlusion size back to it', () => {
    const settings = resolveOptimizeSettings({ textureMaxSize: 1024 }, 'test')
    expect(settings.textureMaxSize).toBe(1024)
    expect(settings.occlusionTextureMaxSize).toBe(1024)
  })

  it('applies a separate occlusion size beside the maximum', () => {
    const settings = resolveOptimizeSettings(
      { textureMaxSize: 2048, occlusionTextureMaxSize: 512 },
      'test',
    )
    expect(settings.textureMaxSize).toBe(2048)
    expect(settings.occlusionTextureMaxSize).toBe(512)
  })

  it('rejects an occlusion size above the maximum, naming the field', () => {
    const broken = { textureMaxSize: 512, occlusionTextureMaxSize: 1024 }
    expect(() => resolveOptimizeSettings(broken, 'pipeline.json')).toThrow(SettingsError)
    try {
      resolveOptimizeSettings(broken, 'pipeline.json')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsError)
      const settingsError = error as SettingsError
      expect(settingsError.source).toBe('pipeline.json')
      expect(settingsError.issues).toEqual([
        { path: 'occlusionTextureMaxSize', message: 'expected at most textureMaxSize (512)' },
      ])
    }
  })

  it('rejects an unknown key, naming it', () => {
    try {
      resolveOptimizeSettings({ textureMaxSise: 1024 }, 'pipeline.json')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsError)
      expect((error as SettingsError).issues).toEqual([
        { path: 'textureMaxSise', message: 'unknown key' },
      ])
    }
  })

  it('rejects a non-integer or out-of-range size, naming the field', () => {
    const resolveWith = (size: unknown): OptimizeSettings =>
      resolveOptimizeSettings({ textureMaxSize: size }, 'test')
    expect(() => resolveWith(1024.5)).toThrow(/textureMaxSize/)
    expect(() => resolveWith(0)).toThrow(/textureMaxSize/)
    expect(() => resolveWith(999999)).toThrow(/textureMaxSize/)
    expect(() => resolveWith('2048')).toThrow(/textureMaxSize/)
  })

  it('keeps the override surface to the size fields only', () => {
    // The structure flags are the Blender contract, not per-product
    // tunables: the same schema that validates the sizes rejects them here.
    expect(() => resolveOptimizeSettings({ prune: true }, 'test')).toThrow(/prune/)
  })

  it('keeps the encoder parameters out of the override surface', () => {
    expect(() => resolveOptimizeSettings({ uastcLevel: 2 }, 'test')).toThrow(/uastcLevel/)
    expect(() => resolveOptimizeSettings({ etc1sQuality: 128 }, 'test')).toThrow(/etc1sQuality/)
    expect(() => resolveOptimizeSettings({ uastcRdoMultithreading: true }, 'test')).toThrow(
      /uastcRdoMultithreading/,
    )
  })

  it('rejects every rdo multithreading value but the deterministic off', () => {
    const withOn = { ...DEFAULT_OPTIMIZE_SETTINGS, uastcRdoMultithreading: true }
    expect(optimizeSettingsSchema.safeParse(withOn).success).toBe(false)
  })

  it('exposes the defaults as a validated settings object', () => {
    expect(DEFAULT_OPTIMIZE_SETTINGS.prune).toBe(false)
    expect(DEFAULT_OPTIMIZE_SETTINGS.textureFormat).toBe('ktx2')
    expect(DEFAULT_OPTIMIZE_SETTINGS.compress).toBe('meshopt')
  })

  it('holds the encoder parameters and reads the size default from the budgets', () => {
    expect(DEFAULT_OPTIMIZE_SETTINGS.uastcLevel).toBe(4)
    expect(DEFAULT_OPTIMIZE_SETTINGS.uastcRdo).toBe(true)
    expect(DEFAULT_OPTIMIZE_SETTINGS.uastcRdoMultithreading).toBe(false)
    expect(DEFAULT_OPTIMIZE_SETTINGS.uastcRdoLambda).toBe(4)
    expect(DEFAULT_OPTIMIZE_SETTINGS.etc1sQuality).toBe(255)
    expect(DEFAULT_OPTIMIZE_SETTINGS.textureMaxSize).toBe(TEXTURE_MAX_SIZE_PX)
  })
})

describe('loadOptimizeSettings', () => {
  let tempDir = ''
  let overrideFile = ''
  let brokenJsonFile = ''
  let invalidFile = ''

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'settings-test-'))
    overrideFile = path.join(tempDir, 'pipeline.json')
    brokenJsonFile = path.join(tempDir, 'broken.json')
    invalidFile = path.join(tempDir, 'invalid.json')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns the defaults and no override for a missing file', async () => {
    const result = await loadOptimizeSettings(path.join(tempDir, 'missing.json'))
    expect(result.usedOverride).toBe(false)
    expect(result.settings).toEqual(DEFAULT_OPTIMIZE_SETTINGS)
  })

  it('propagates a read error that is not a missing file', async () => {
    // A path Node rejects outright: never a missing file, so never the
    // defaults.
    await expect(loadOptimizeSettings('bad\0settings.json')).rejects.toThrow()
  })

  it('loads and validates an override file', async () => {
    await writeFile(overrideFile, JSON.stringify({ occlusionTextureMaxSize: 512 }))
    const result = await loadOptimizeSettings(overrideFile)
    expect(result.usedOverride).toBe(true)
    expect(result.settings.occlusionTextureMaxSize).toBe(512)
    expect(result.settings.textureMaxSize).toBe(2048)
  })

  it('fails loudly on broken JSON, naming the file', async () => {
    await writeFile(brokenJsonFile, '{ not json')
    try {
      await loadOptimizeSettings(brokenJsonFile)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsError)
      expect((error as SettingsError).source).toBe(brokenJsonFile)
      expect((error as SettingsError).message).toContain('expected valid JSON')
    }
  })

  it('fails loudly on an invalid field, naming the file and the field', async () => {
    await writeFile(invalidFile, JSON.stringify({ occlusionTextureMaxSize: -8 }))
    try {
      await loadOptimizeSettings(invalidFile)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsError)
      expect((error as SettingsError).source).toBe(invalidFile)
      expect((error as SettingsError).message).toContain('occlusionTextureMaxSize')
    }
  })
})
