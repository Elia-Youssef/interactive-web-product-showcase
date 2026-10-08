// The material-group rules of the contract, as table entries: only the
// extensions the loader parses and the contract allows (which also
// refuses the emissive strength extension), single-sided materials unless
// a mesh has open edges, and lit materials opaque.

import type { ContractRule } from './contractRules.ts'

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
  {
    key: 'only-allowed-extensions',
    group: 'materials',
    check: ({ facts }) => ({
      violations: facts.extensionsUsed
        .filter((extension) => !ALLOWED_EXTENSIONS.includes(extension))
        .map((extension) => `the file uses extension '${extension}', outside the allowed set`),
      warnings: [],
    }),
  },
  {
    key: 'single-sided-materials',
    group: 'materials',
    check: ({ facts }) => ({
      violations: facts.materials
        .filter((material) => material.doubleSided)
        .flatMap((material) =>
          facts.primitives
            .filter(
              (primitive) =>
                primitive.materialNames.includes(material.name) && !primitive.openEdges,
            )
            .map(
              (primitive) =>
                `the material '${material.name}' is double-sided on the closed mesh of ${primitive.nodeName}, ` +
                'single-sided unless a mesh has open edges',
            ),
        ),
      warnings: [],
    }),
  },
  {
    key: 'lit-materials-opaque',
    group: 'materials',
    check: ({ facts }) => ({
      violations: facts.materials
        .filter((material) => !material.unlit && material.alphaMode !== 'OPAQUE')
        .map(
          (material) =>
            `the lit material '${material.name}' is alphaMode ${material.alphaMode}, lit materials are opaque`,
        ),
      warnings: [],
    }),
  },
]
