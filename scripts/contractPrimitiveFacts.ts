// The primitive-level facts of the contract: every mesh node's primitives
// with the materials they can wear, and the topology facts the geometry
// rules read. Plain data, like the rest of the contract facts, so every
// rule stays a pure function and the document never leaves the model step.

import type { Document, Node, Primitive } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'

// One primitive, named by the node whose mesh holds it: the materials it
// can wear (its default plus every variant mapping), whether it carries a
// TANGENT attribute, whether its triangles leave an open edge, and how
// many coincident duplicate triangles it holds.
export type ContractPrimitiveFact = {
  readonly nodeName: string
  readonly materialNames: readonly string[]
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
    for (const primitive of mesh.listPrimitives()) {
      facts.push({
        nodeName,
        materialNames: materialNamesOf(primitive),
        tangent: primitive.getAttribute('TANGENT') !== null,
        openEdges: hasOpenEdges(primitive),
        duplicateTriangles: duplicateTriangleCount(primitive),
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

// The default material plus every mapped variant material, by name.
function materialNamesOf(primitive: Primitive): readonly string[] {
  const names: string[] = []
  const material = primitive.getMaterial()
  if (material !== null) {
    names.push(material.getName())
  }
  const list = primitive.getExtension(KHRMaterialsVariants.EXTENSION_NAME) as MappingList | null
  if (list !== null) {
    for (const mapping of list.listMappings()) {
      const mapped = mapping.getMaterial()
      if (mapped !== null) {
        names.push(mapped.getName())
      }
    }
  }
  return names
}

// Whether the primitive's triangles leave an open edge: an edge used by
// exactly one triangle. Non-indexed triangles read their vertices as their
// own indices, the way the loader renders them.
function hasOpenEdges(primitive: Primitive): boolean {
  const uses = edgeUsesOf(primitive)
  for (const use of uses.values()) {
    if (use === 1) {
      return true
    }
  }
  return false
}

// How many triangles share their three vertices with another triangle of
// the same primitive, whatever their winding: a coincident duplicate sheet.
function duplicateTriangleCount(primitive: Primitive): number {
  const triangles = trianglesOf(primitive)
  const seen = new Set<string>()
  let duplicates = 0
  for (const triangle of triangles) {
    const key = [...triangle].sort((a, b) => a - b).join(' ')
    if (seen.has(key)) {
      duplicates += 1
    }
    seen.add(key)
  }
  return duplicates
}

function edgeUsesOf(primitive: Primitive): Map<number, number> {
  const uses = new Map<number, number>()
  for (const [a, b, c] of trianglesOf(primitive)) {
    countEdge(uses, a, b)
    countEdge(uses, b, c)
    countEdge(uses, c, a)
  }
  return uses
}

function countEdge(uses: Map<number, number>, a: number, b: number): void {
  const key = a < b ? a * EDGE_SPAN + b : b * EDGE_SPAN + a
  uses.set(key, (uses.get(key) ?? 0) + 1)
}

// Every triangle's vertex indices; a vertex count over the numeric key
// space keeps the edge keys exact.
const EDGE_SPAN = 1 << 21

function trianglesOf(primitive: Primitive): readonly (readonly [number, number, number])[] {
  const indices = primitive.getIndices()?.getArray() ?? null
  if (indices !== null) {
    const triangles: (readonly [number, number, number])[] = []
    for (let i = 0; i + 2 < indices.length; i += 3) {
      triangles.push([indices[i] ?? 0, indices[i + 1] ?? 0, indices[i + 2] ?? 0])
    }
    return triangles
  }
  const position = primitive.getAttribute('POSITION')
  const count = position?.getCount() ?? 0
  const triangles: (readonly [number, number, number])[] = []
  for (let i = 0; i + 2 < count; i += 3) {
    triangles.push([i, i + 1, i + 2])
  }
  return triangles
}
