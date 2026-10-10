// The finishes-group rules of the contract, as table entries: the variant
// map is well formed, a primitive that maps some finishes maps all of
// them, and the assigned default materials are the manifest's first
// finish.

import type { ContractRule } from './contractRules.ts'
import { defineContractRule } from './contractRule.ts'

export const finishRules: readonly ContractRule[] = [
  defineContractRule({
    key: 'variant-map-well-formed',
    group: 'finishes',
    needs: ['facts', 'structure'],
    check: ({ facts, structure }) => {
      const violations: string[] = []
      if (structure.variantNames.some((name) => name === '')) {
        violations.push('a declared variant has no name')
      }
      for (const mapping of facts.mappings) {
        for (const entry of mapping.mappings) {
          if (
            entry.materialIndex === null ||
            !facts.materials.some((m) => m.index === entry.materialIndex)
          ) {
            violations.push(
              `the variant mapping of ${mapping.nodeName} names no material of the file: '${entry.materialName ?? 'none'}'`,
            )
          }
          if (entry.variantNames.length === 0) {
            violations.push(`the variant mapping of ${mapping.nodeName} names no variant`)
          }
        }
      }
      return { violations, warnings: [] }
    },
  }),
  defineContractRule({
    key: 'mappings-cover-every-variant',
    group: 'finishes',
    needs: ['facts', 'structure'],
    check: ({ facts, structure }) => ({
      violations: facts.mappings.flatMap((mapping) => {
        const mapped = mapping.mappings.flatMap((entry) => entry.variantNames)
        const twice = mapped.filter((variant, index) => mapped.indexOf(variant) !== index)
        const missing = structure.variantNames.filter((variant) => !mapped.includes(variant))
        return [
          ...twice.map(
            (variant) => `the primitive of ${mapping.nodeName} maps the variant '${variant}' twice`,
          ),
          ...missing.map(
            (variant) =>
              `the primitive of ${mapping.nodeName} maps some finishes but not '${variant}', a finish-dependent slot maps every variant`,
          ),
        ]
      }),
      warnings: [],
    }),
  }),
  defineContractRule({
    key: 'default-is-first-finish',
    group: 'finishes',
    needs: ['manifest', 'facts'],
    check: ({ manifest, facts }) => {
      const first = manifest.finishes[0]
      if (first === undefined) {
        return { violations: [], warnings: [] }
      }
      const violations: string[] = []
      for (const mapping of facts.mappings) {
        const entry = mapping.mappings.find((candidate) =>
          candidate.variantNames.includes(first.variant),
        )
        if (entry === undefined || entry.materialIndex === mapping.defaultMaterialIndex) {
          continue
        }
        violations.push(
          `the primitive of ${mapping.nodeName} defaults to '${mapping.defaultMaterialName ?? 'none'}', ` +
            `the first finish '${first.variant}' maps '${entry.materialName ?? 'none'}'`,
        )
      }
      return { violations, warnings: [] }
    },
  }),
]
