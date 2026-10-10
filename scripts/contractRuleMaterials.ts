// The material-group rules of the contract, as table entries: only the
// extensions the loader parses and the contract allows (which also
// refuses the emissive strength extension), single-sided materials unless
// a mesh has open edges, lit materials opaque, and the occlusion contract:
// every lit material samples one shared occlusion image through texCoord 1.

import type { ContractRule } from './contractRules.ts'
import { defineContractRule } from './contractRule.ts'

// The authoring extensions the render path and the contract use, and the
// marks the optimize step writes: anything else in extensionsUsed renders
// silently as plain PBR or breaks a rule that reads the file.
const ALLOWED_EXTENSIONS: readonly string[] = [
  'KHR_materials_variants',
  'KHR_materials_unlit',
  'KHR_materials_sheen',
  'KHR_materials_clearcoat',
  'KHR_materials_anisotropy',
  'KHR_texture_transform',
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
  'KHR_mesh_quantization',
]

export const materialRules: readonly ContractRule[] = [
  defineContractRule({
    key: 'only-allowed-extensions',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => ({
      violations: facts.extensionsUsed
        .filter((extension) => !ALLOWED_EXTENSIONS.includes(extension))
        .map((extension) => `the file uses extension '${extension}', outside the allowed set`),
      warnings: [],
    }),
  }),
  defineContractRule({
    key: 'single-sided-materials',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => ({
      violations: facts.materials
        .filter((material) => material.doubleSided)
        .flatMap((material) =>
          facts.primitives
            .filter(
              (primitive) =>
                primitive.materialIndices.includes(material.index) && !primitive.openEdges,
            )
            .map(
              (primitive) =>
                `the material '${material.name}' is double-sided on the closed mesh of ${primitive.nodeName}, ` +
                'single-sided unless a mesh has open edges',
            ),
        ),
      warnings: [],
    }),
  }),
  defineContractRule({
    key: 'lit-materials-opaque',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => ({
      violations: facts.materials
        .filter((material) => !material.unlit && material.alphaMode !== 'OPAQUE')
        .map(
          (material) =>
            `the lit material '${material.name}' is alphaMode ${material.alphaMode}, lit materials are opaque`,
        ),
      warnings: [],
    }),
  }),
  defineContractRule({
    key: 'lit-materials-occluded',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => ({
      violations: facts.materials
        .filter((material) => !material.unlit && material.occlusionImage === null)
        .map(
          (material) =>
            `the lit material '${material.name}' carries no occlusion texture, ` +
            'every lit material samples the shared occlusion image',
        ),
      warnings: [],
    }),
  }),
  defineContractRule({
    key: 'one-occlusion-image',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => {
      const images = new Set<number>(
        facts.materials.flatMap((material) =>
          material.occlusionImage === null ? [] : [material.occlusionImage],
        ),
      )
      if (images.size === 1) {
        return { violations: [], warnings: [] }
      }
      if (images.size === 0) {
        return {
          violations: ['no occlusion slot samples an image, one occlusion image across the file'],
          warnings: [],
        }
      }
      return {
        violations: [
          `the occlusion slots sample ${images.size} images (${[...images].sort((a, b) => a - b).join(', ')}), ` +
            'one occlusion image across the file',
        ],
        warnings: [],
      }
    },
  }),
  defineContractRule({
    key: 'occlusion-texcoord-second-set',
    group: 'materials',
    needs: ['facts'],
    check: ({ facts }) => ({
      violations: facts.materials
        .filter(
          (material) => material.occlusionTexCoord !== null && material.occlusionTexCoord !== 1,
        )
        .map(
          (material) =>
            `the occlusion slot of '${material.name}' samples texCoord ${material.occlusionTexCoord}, ` +
            'the occlusion UV map is TEXCOORD_1',
        ),
      warnings: [],
    }),
  }),
]
