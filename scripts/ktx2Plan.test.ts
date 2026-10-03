import { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { dataTextureSlots, occlusionSlot, stageSizeRule } from './ktx2Plan.ts'
import { buildEncodePlan } from './ktx2Plan.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'
import { docWithTextures, textureByName } from './texture.fixtures.ts'

const settings = DEFAULT_OPTIMIZE_SETTINGS

describe('stageSizeRule', () => {
  it('gives only the occlusion stage the per-product override', () => {
    expect(stageSizeRule('data')).toBe('textureMaxSize')
    expect(stageSizeRule('occlusion')).toBe('occlusionTextureMaxSize')
    expect(stageSizeRule('color')).toBe('textureMaxSize')
  })
})

describe('slot filters', () => {
  it('selects the data texture slots as case-insensitive substrings', () => {
    expect(dataTextureSlots(['normalTexture'])).toBe(true)
    expect(dataTextureSlots(['metallicRoughnessTexture'])).toBe(true)
    expect(dataTextureSlots(['clearcoatNormalTexture'])).toBe(true)
    expect(dataTextureSlots(['baseColorTexture'])).toBe(false)
    expect(dataTextureSlots([])).toBe(false)
  })

  it('selects the occlusion slot as a case-insensitive substring', () => {
    expect(occlusionSlot(['occlusionTexture'])).toBe(true)
    expect(occlusionSlot(['OcclusionTexture'])).toBe(true)
    expect(occlusionSlot(['baseColorTexture'])).toBe(false)
    expect(occlusionSlot([])).toBe(false)
  })
})

describe('buildEncodePlan', () => {
  it('gives a texture that is already KTX2 no entry', () => {
    const doc = docWithTextures([{ name: 'ao-only', slots: ['occlusionTexture'] }])
    textureByName(doc, 'ao-only')?.setMimeType('image/ktx2')
    const plan = buildEncodePlan(doc, settings)
    expect(plan.entries).toEqual([])
  })

  it('fails on an unsupported source format before anything runs', () => {
    const doc = docWithTextures([{ name: 'ao-only', slots: ['occlusionTexture'] }])
    textureByName(doc, 'ao-only')?.setMimeType('image/webp')
    expect(() => buildEncodePlan(doc, settings)).toThrow(
      /ao-only: unsupported source format 'image\/webp'/,
    )
  })

  it('fails on a texture without image data before anything runs', () => {
    const doc = new Document()
    const texture = doc.createTexture('no-image').setMimeType('image/png')
    doc.createMaterial('m').setOcclusionTexture(texture)
    expect(() => buildEncodePlan(doc, settings)).toThrow(
      /no-image: texture is unreadable and cannot be encoded/,
    )
  })

  it('fails loudly on corrupt image data, as the CLI did', () => {
    const doc = docWithTextures([{ name: 'ao-only', slots: ['occlusionTexture'] }])
    textureByName(doc, 'ao-only')?.setImage(new Uint8Array(0))
    expect(() => buildEncodePlan(doc, settings)).toThrow()
  })

  it('claims an unattached texture last, for the color stage', () => {
    const doc = docWithTextures([{ name: 'orphan', slots: [] }])
    const plan = buildEncodePlan(doc, settings)
    expect(plan.entries).toHaveLength(1)
    expect(plan.entries[0]?.stage).toBe('color')
    expect(plan.entries[0]?.mode).toBe('etc1s')
    // No slot means no known color space, so no transfer function is
    // assigned, as the CLI did for a texture without slots.
    expect(plan.entries[0]?.arguments).not.toContain('--assign-tf')
  })
})
