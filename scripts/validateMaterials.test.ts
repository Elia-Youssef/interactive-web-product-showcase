// The material contract check the validate step runs: anisotropy enters as
// authored strength only, so a texture-driven anisotropy is rejected naming
// the material. The document is built in memory with @gltf-transform/core,
// like every validate suite.
import { describe, expect, it } from 'vitest'
import { KHRMaterialsAnisotropy } from '@gltf-transform/extensions'
import { readProductStructure } from './structure.ts'
import { buildDocument } from './validateFixtures.ts'
import { checkMaterials } from './validateChecks.ts'

describe('the materials check', () => {
  it('rejects a material whose anisotropy reads through a texture', () => {
    const doc = buildDocument()
    const texture = doc.createTexture('T_anisotropy')
    const material = doc.createMaterial('MAT_aniso')
    const extension = doc.createExtension(KHRMaterialsAnisotropy)
    material.setExtension(
      'KHR_materials_anisotropy',
      extension.createAnisotropy().setAnisotropyTexture(texture),
    )
    const result = checkMaterials(readProductStructure(doc))
    expect(result.violations).toEqual([
      "anisotropy texture on material 'MAT_aniso': only authored anisotropy strength is supported",
    ])
    expect(result.detail).toBe('1 anisotropy textures')
  })

  it('passes a document whose anisotropy is authored strength only', () => {
    const doc = buildDocument()
    const material = doc.createMaterial('MAT_aniso')
    const extension = doc.createExtension(KHRMaterialsAnisotropy)
    material.setExtension(
      'KHR_materials_anisotropy',
      extension.createAnisotropy().setAnisotropyStrength(0.5),
    )
    const result = checkMaterials(readProductStructure(doc))
    expect(result.status).toBe('pass')
    expect(result.detail).toBe('no anisotropy textures')
  })
})
