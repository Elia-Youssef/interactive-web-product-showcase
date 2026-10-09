// The primitive-level facts of the contract: every mesh node's primitives
// with the materials they can wear, and the topology facts the geometry
// rules read. Plain data, like the rest of the contract facts, so every
// rule stays a pure function and the document never leaves the model step.

import type { Document, Material, Node, Primitive } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'
import { meshTopology } from './meshTopology.ts'

// One primitive, named by the node whose mesh holds it: the materials it
// can wear (its default plus every variant mapping), whether it carries a
// TANGENT attribute, whether its triangles leave an open edge, and how
// many coincident duplicate triangles it holds.
export type ContractPrimitiveFact = {
  readonly nodeName: string
  readonly materialIndices: readonly number[]
  readonly tangent: boolean
  readonly openEdges: boolean
  readonly duplicateTriangles: number
}

// Every mesh node's primitives, with the topology facts the geometry rules
// read. Nodes without names stand behind their nearest named ancestor, the
// way the hotspot and bounds readers resolve them.
export function primitiveFacts(doc: Document): ContractPrimitiveFact[] {
  const facts: ContractPrimitiveFact[] = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) {
      continue
    }
    const nodeName = node.getName() !== '' ? node.getName() : nearestNamedAncestorOf(node)
    const primitives = mesh.listPrimitives()
    const topology = meshTopology(primitives)
    for (const [index, primitive] of primitives.entries()) {
      const geometry = topology[index]
      if (geometry === undefined) throw new Error('every primitive needs its geometric facts')
      facts.push({
        nodeName,
        materialIndices: materialIndicesOf(primitive, doc.getRoot().listMaterials()),
        tangent: primitive.getAttribute('TANGENT') !== null,
        ...geometry,
      })
    }
  }
  return facts
}

export function nearestNamedAncestorOf(node: Node): string {
  for (let parent = node.getParentNode(); parent !== null; parent = parent.getParentNode()) {
    if (parent.getName() !== '') {
      return parent.getName()
    }
  }
  return 'the scene root'
}

// The default material plus every mapped variant material, by table index.
function materialIndicesOf(
  primitive: Primitive,
  materials: readonly Material[],
): readonly number[] {
  const indices: number[] = []
  const material = primitive.getMaterial()
  if (material !== null) {
    indices.push(materials.indexOf(material))
  }
  const list = primitive.getExtension(KHRMaterialsVariants.EXTENSION_NAME) as MappingList | null
  if (list !== null) {
    for (const mapping of list.listMappings()) {
      const mapped = mapping.getMaterial()
      if (mapped !== null) {
        indices.push(materials.indexOf(mapped))
      }
    }
  }
  return indices
}
