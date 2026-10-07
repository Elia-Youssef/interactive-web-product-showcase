// The naming, node and shadow rules of the contract's model group, as
// table entries: every node carries a contract name, one node per contract
// name, exactly one SHADOW mesh, no extras, no lights, and the shadow
// plane's own contract (a root object with one material; unlit blend with
// no mapping).

import {
  CAMERA_PREFIX,
  HOTSPOT_PREFIX,
  PART_PREFIX,
  SHADOW_NODE_NAME,
} from '../src/lib/product/contractNames.ts'
import type { ContractRule } from './contractRules.ts'

// A name the contract knows: one of its three prefixes, or the shadow.
export function isContractName(name: string): boolean {
  return (
    name.startsWith(PART_PREFIX) ||
    name.startsWith(HOTSPOT_PREFIX) ||
    name.startsWith(CAMERA_PREFIX) ||
    name === SHADOW_NODE_NAME
  )
}

export const modelRules: readonly ContractRule[] = [
  {
    key: 'nodes-carry-contract-names',
    group: 'model',
    check: ({ facts }) => ({
      violations: facts.nodes
        .filter((node) => !isContractName(node.name))
        .map(
          (node) => `node '${node.name}' is outside the contract names PART_, HS_, CAM_ and SHADOW`,
        ),
      warnings: [],
    }),
  },
  {
    key: 'one-node-per-contract-name',
    group: 'model',
    check: ({ facts }) => {
      const counts = new Map<string, number>()
      for (const node of facts.nodes) {
        if (isContractName(node.name)) {
          counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
        }
      }
      return {
        violations: [...counts]
          .filter(([, count]) => count > 1)
          .map(
            ([name, count]) =>
              `node name '${name}' appears ${count} times, the contract needs one node per name`,
          ),
        warnings: [],
      }
    },
  },
  {
    key: 'one-shadow-mesh',
    group: 'model',
    check: ({ facts }) => {
      const shadows = facts.nodes.filter((node) => node.name === SHADOW_NODE_NAME)
      if (shadows.length !== 1) {
        return {
          violations: [`expected exactly one ${SHADOW_NODE_NAME} mesh, found ${shadows.length}`],
          warnings: [],
        }
      }
      const shadow = shadows[0]
      if (shadow === undefined || !shadow.carriesMesh) {
        return {
          violations: [
            `the ${SHADOW_NODE_NAME} node carries no mesh, the baked contact shadow is required`,
          ],
          warnings: [],
        }
      }
      return { violations: [], warnings: [] }
    },
  },
  {
    key: 'no-extras',
    group: 'model',
    check: ({ facts }) => ({
      violations: facts.extrasBearers.map(
        (bearer) => `${bearer} carries extras, no custom property may reach the file`,
      ),
      warnings: [],
    }),
  },
  {
    key: 'no-lights',
    group: 'model',
    check: ({ facts }) => ({
      violations: facts.lightsPresent
        ? ['the model carries lights, the site lights the product with its environment only']
        : [],
      warnings: [],
    }),
  },
  {
    key: 'shadow-root-one-material',
    group: 'model',
    check: ({ facts }) => {
      const shadow = facts.nodes.find((node) => node.name === SHADOW_NODE_NAME)
      if (shadow === undefined || !shadow.carriesMesh) {
        return { violations: [], warnings: [] }
      }
      if (!shadow.rooted) {
        return {
          violations: [
            `the ${SHADOW_NODE_NAME} node is not a root object, it must not be parented to a part`,
          ],
          warnings: [],
        }
      }
      return { violations: shadowPrimitiveViolations(facts), warnings: [] }
    },
  },
  {
    key: 'shadow-material-unlit-blend',
    group: 'model',
    check: ({ facts }) => {
      const shadowMaterial = shadowMaterialOf(facts)
      if (shadowMaterial === undefined) {
        return { violations: [], warnings: [] }
      }
      const violations: string[] = []
      if (!shadowMaterial.unlit) {
        violations.push(`the shadow material '${shadowMaterial.name}' is not unlit`)
      }
      if (shadowMaterial.alphaMode !== 'BLEND') {
        violations.push(
          `the shadow material '${shadowMaterial.name}' is alphaMode ${shadowMaterial.alphaMode}, expected BLEND`,
        )
      }
      if (facts.mappings.some((mapping) => mapping.nodeName === SHADOW_NODE_NAME)) {
        violations.push(
          `the ${SHADOW_NODE_NAME} primitive carries a variant mapping, the shadow shows in every finish`,
        )
      }
      return { violations, warnings: [] }
    },
  },
]

// How many primitives the shadow's mesh holds, from the primitive facts.
function countShadowPrimitives(facts: { primitives: readonly { nodeName: string }[] }): number {
  return facts.primitives.filter((primitive) => primitive.nodeName === SHADOW_NODE_NAME).length
}

function shadowPrimitiveViolations(facts: {
  primitives: readonly { nodeName: string }[]
}): readonly string[] {
  const count = countShadowPrimitives(facts)
  if (count !== 1) {
    return [
      `the ${SHADOW_NODE_NAME} mesh holds ${count} primitives, the shadow carries one material`,
    ]
  }
  return []
}

// The material the shadow's one primitive wears, when it wears one.
function shadowMaterialOf(facts: {
  materials: readonly { name: string; unlit: boolean; alphaMode: string }[]
  primitives: readonly { nodeName: string; materialNames: readonly string[] }[]
}): { name: string; unlit: boolean; alphaMode: string } | undefined {
  const primitive = facts.primitives.find((candidate) => candidate.nodeName === SHADOW_NODE_NAME)
  const materialName = primitive?.materialNames[0]
  return facts.materials.find((material) => material.name === materialName)
}
