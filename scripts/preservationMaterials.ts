import type { Document, Material, Texture, TextureInfo } from '@gltf-transform/core'
import type { Anisotropy, Clearcoat, Sheen, Transform } from '@gltf-transform/extensions'

function textureFact(doc: Document, texture: Texture | null, info: TextureInfo | null) {
  if (texture === null || info === null) return null
  const canonical = doc
    .getRoot()
    .listTextures()
    .find((other) => texture.equals(other, new Set(['name', 'uri'])))
  const transform = info.getExtension<Transform>('KHR_texture_transform')
  return {
    name: canonical?.getName() ?? texture.getName(),
    texCoord: info.getTexCoord(),
    mag: info.getMagFilter(),
    min: info.getMinFilter(),
    wrapS: info.getWrapS(),
    wrapT: info.getWrapT(),
    transform:
      transform === null
        ? null
        : {
            offset: transform.getOffset(),
            rotation: transform.getRotation(),
            scale: transform.getScale(),
            texCoord: transform.getTexCoord(),
          },
  }
}

function clearcoatFact(doc: Document, clearcoat: Clearcoat | null) {
  return clearcoat === null
    ? null
    : {
        factor: clearcoat.getClearcoatFactor(),
        roughness: clearcoat.getClearcoatRoughnessFactor(),
        normalScale: clearcoat.getClearcoatNormalScale(),
        texture: textureFact(
          doc,
          clearcoat.getClearcoatTexture(),
          clearcoat.getClearcoatTextureInfo(),
        ),
        roughnessTexture: textureFact(
          doc,
          clearcoat.getClearcoatRoughnessTexture(),
          clearcoat.getClearcoatRoughnessTextureInfo(),
        ),
        normalTexture: textureFact(
          doc,
          clearcoat.getClearcoatNormalTexture(),
          clearcoat.getClearcoatNormalTextureInfo(),
        ),
      }
}

function extensionFacts(doc: Document, material: Material) {
  const sheen = material.getExtension<Sheen>('KHR_materials_sheen')
  const clearcoat = material.getExtension<Clearcoat>('KHR_materials_clearcoat')
  const anisotropy = material.getExtension<Anisotropy>('KHR_materials_anisotropy')
  return {
    unlit: material.getExtension('KHR_materials_unlit') !== null,
    sheen:
      sheen === null
        ? null
        : {
            color: sheen.getSheenColorFactor(),
            roughness: sheen.getSheenRoughnessFactor(),
            colorTexture: textureFact(
              doc,
              sheen.getSheenColorTexture(),
              sheen.getSheenColorTextureInfo(),
            ),
            roughnessTexture: textureFact(
              doc,
              sheen.getSheenRoughnessTexture(),
              sheen.getSheenRoughnessTextureInfo(),
            ),
          },
    clearcoat: clearcoatFact(doc, clearcoat),
    anisotropy:
      anisotropy === null
        ? null
        : {
            strength: anisotropy.getAnisotropyStrength(),
            rotation: anisotropy.getAnisotropyRotation(),
            texture: textureFact(
              doc,
              anisotropy.getAnisotropyTexture(),
              anisotropy.getAnisotropyTextureInfo(),
            ),
          },
  }
}

export function materialFactOf(doc: Document, material: Material | null) {
  if (material === null) return null
  // The assigned material's values identify it even when distinct
  // materials share a name. Image bytes and dimensions are encoding work;
  // slots, sampler state and texture transforms retain authored meaning.
  return {
    name: material.getName(),
    signature: JSON.stringify({
      color: material.getBaseColorFactor(),
      emissive: material.getEmissiveFactor(),
      metallic: material.getMetallicFactor(),
      roughness: material.getRoughnessFactor(),
      alpha: material.getAlphaMode(),
      cutoff: material.getAlphaCutoff(),
      sided: material.getDoubleSided(),
      normalScale: material.getNormalScale(),
      occlusionStrength: material.getOcclusionStrength(),
      baseColor: textureFact(
        doc,
        material.getBaseColorTexture(),
        material.getBaseColorTextureInfo(),
      ),
      emissiveTexture: textureFact(
        doc,
        material.getEmissiveTexture(),
        material.getEmissiveTextureInfo(),
      ),
      normal: textureFact(doc, material.getNormalTexture(), material.getNormalTextureInfo()),
      occlusion: textureFact(
        doc,
        material.getOcclusionTexture(),
        material.getOcclusionTextureInfo(),
      ),
      metallicRoughness: textureFact(
        doc,
        material.getMetallicRoughnessTexture(),
        material.getMetallicRoughnessTextureInfo(),
      ),
      extensions: extensionFacts(doc, material),
    }),
  }
}

export type PreservedMaterial = ReturnType<typeof materialFactOf>
