// The geometry-group rules of the contract, as table entries: parts are
// root objects that carry location only, no coincident duplicate
// triangles, and every normal-mapped primitive carries TANGENT.

import { PART_PREFIX } from '../src/lib/product/contractNames.ts'
import type { ContractRule } from './contractRules.ts'

export const geometryRules: readonly ContractRule[] = [
  {
    key: 'parts-root-location-only',
    group: 'geometry',
    check: ({ facts }) => {
      const violations: string[] = []
      for (const node of facts.nodes) {
        if (!node.name.startsWith(PART_PREFIX)) {
          continue
        }
        if (!node.rooted) {
          violations.push(`the part ${node.name} is not a root object, parts parent nowhere`)
        }
        if (node.rotation !== null && !isIdentityRotation(node.rotation)) {
          violations.push(`the part ${node.name} carries a rotation, parts carry location only`)
        }
      }
      return { violations, warnings: [] }
    },
  },
  {
    key: 'no-duplicate-triangles',
    group: 'geometry',
    check: ({ facts }) => ({
      violations: facts.primitives
        .filter((primitive) => primitive.duplicateTriangles > 0)
        .map(
          (primitive) =>
            `the mesh of ${primitive.nodeName} holds ${primitive.duplicateTriangles} coincident duplicate triangles, no duplicate sheets`,
        ),
      warnings: [],
    }),
  },
  {
    key: 'tangents-with-normal-maps',
    group: 'geometry',
    check: ({ facts }) => ({
      violations: facts.primitives
        .filter(
          (primitive) =>
            !primitive.tangent &&
            primitive.materialNames.some((name) =>
              facts.materials.some((m) => m.name === name && m.normalMapped),
            ),
        )
        .map(
          (primitive) =>
            `the primitive of ${primitive.nodeName} wears a normal map without a TANGENT attribute`,
        ),
      warnings: [],
    }),
  },
]

// Whether a stored quaternion is the identity rotation.
function isIdentityRotation(rotation: readonly [number, number, number, number]): boolean {
  return rotation[0] === 0 && rotation[1] === 0 && rotation[2] === 0 && rotation[3] === 1
}
