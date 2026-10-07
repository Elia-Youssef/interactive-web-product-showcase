// The contract facts the byte-level rule table reads from a product
// document: nodes and their transforms, cameras' world up, materials,
// primitives with their topology, the variant mappings, and the document's
// extensions, lights and extras. Plain data, like the structure facts
// beside it, so every rule stays a pure function and the document never
// leaves the model step.

import type { Document, Node, Primitive, Property } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'
import { isMat4 } from '../src/lib/camera/frame.ts'
import type { Vec3 } from '../src/lib/camera/frame.ts'

// One named node: whether it is a root object (no parent node), the
// translation and rotation the document authors (null when absent), and
// whether the node itself carries a mesh.
export type ContractNodeFact = {
  readonly name: string
  readonly rooted: boolean
  readonly translation: Vec3 | null
  readonly rotation: readonly [number, number, number, number] | null
  readonly carriesMesh: boolean
}

// One camera node's world up column: the direction the stored camera calls
// up, which the roll rule compares with the roll-free up the viewer
// rebuilds. null when the camera is not perspective (it carries no view).
export type ContractCameraFact = {
  readonly name: string
  readonly up: Vec3 | null
}

// One material: the slots the render contract reads.
export type ContractMaterialFact = {
  readonly name: string
  readonly unlit: boolean
  readonly doubleSided: boolean
  readonly alphaMode: string
  readonly normalMapped: boolean
}

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

// One mapped primitive's variant table: its default material and every
// mapping's material with the variants it names.
export type ContractMappingFact = {
  readonly nodeName: string
  readonly defaultMaterialName: string | null
  readonly mappings: readonly {
    readonly materialName: string | null
    readonly variantNames: readonly string[]
  }[]
}

export type ContractModelFacts = {
  readonly nodes: readonly ContractNodeFact[]
  readonly cameras: readonly ContractCameraFact[]
  readonly materials: readonly ContractMaterialFact[]
  readonly primitives: readonly ContractPrimitiveFact[]
  readonly mappings: readonly ContractMappingFact[]
  readonly extensionsUsed: readonly string[]
  readonly lightsPresent: boolean
  readonly extrasBearers: readonly string[]
}

const LIGHTS_EXTENSION = 'KHR_lights_punctual'

export function readContractModelFacts(doc: Document): ContractModelFacts {
  const root = doc.getRoot()
  const nodes = root.listNodes().filter((node) => node.getName() !== '')
  return {
    nodes: nodes.map((node) => ({
      name: node.getName(),
      rooted: node.getParentNode() === null,
      translation: vec3OrNull(node.getTranslation()),
      rotation: quaternionOrNull(node.getRotation()),
      carriesMesh: node.getMesh() !== null,
    })),
    cameras: root
      .listNodes()
      .map(cameraUpOf)
      .filter((fact) => fact !== null),
    materials: root.listMaterials().map((material) => ({
      name: material.getName(),
      unlit: material.getExtension('KHR_materials_unlit') !== null,
      doubleSided: material.getDoubleSided(),
      alphaMode: material.getAlphaMode() ?? 'OPAQUE',
      normalMapped: material.getNormalTexture() !== null,
    })),
    primitives: primitiveFacts(doc),
    mappings: mappingFacts(doc),
    extensionsUsed: root.listExtensionsUsed().map((extension) => extension.extensionName),
    lightsPresent:
      root.listExtensionsUsed().some((e) => e.extensionName === LIGHTS_EXTENSION) ||
      root.listNodes().some((node) => node.getExtension(LIGHTS_EXTENSION) !== null),
    extrasBearers: extrasBearers(doc),
  }
}

// The camera's world up column, or null for a node with no camera or one
// that is not perspective: the roll rule reads only cameras the site can
// present.
function cameraUpOf(node: Node): ContractCameraFact | null {
  const camera = node.getCamera()
  if (camera === null || camera.getType() !== 'perspective') {
    return null
  }
  const world = node.getWorldMatrix()
  if (!isMat4(world)) {
    return null
  }
  return { name: node.getName(), up: [world[4] ?? 0, world[5] ?? 0, world[6] ?? 0] }
}

function vec3OrNull(values: readonly number[] | null): Vec3 | null {
  if (values === null) {
    return null
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
}

function quaternionOrNull(
  values: readonly number[] | null,
): readonly [number, number, number, number] | null {
  if (values === null) {
    return null
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1]
}

// Every mesh node's primitives, with the topology facts the geometry rules
// read. Nodes without names stand behind their nearest named ancestor, the
// way the hotspot and bounds readers resolve them.
function primitiveFacts(doc: Document): ContractPrimitiveFact[] {
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

function nearestNamedAncestorOf(node: Node): string {
  for (let parent = node.getParentNode(); parent !== null; parent = parent.getParentNode()) {
    if (parent.getName() !== '') {
      return parent.getName()
    }
  }
  return 'the scene root'
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

// Every mapped primitive's variant table.
function mappingFacts(doc: Document): ContractMappingFact[] {
  const facts: ContractMappingFact[] = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (mesh === null) {
      continue
    }
    const nodeName = node.getName() !== '' ? node.getName() : nearestNamedAncestorOf(node)
    for (const primitive of mesh.listPrimitives()) {
      const list = primitive.getExtension<MappingList>('KHR_materials_variants')
      if (list === null) {
        continue
      }
      facts.push({
        nodeName,
        defaultMaterialName: primitive.getMaterial()?.getName() ?? null,
        mappings: list.listMappings().map((mapping) => ({
          materialName: mapping.getMaterial()?.getName() ?? null,
          variantNames: mapping.listVariants().map((variant) => variant.getName()),
        })),
      })
    }
  }
  return facts
}

// Every property of every table that carries extras, labelled by its table
// and name: the rule reports exactly where the file leaks authoring data.
function extrasBearers(doc: Document): readonly string[] {
  const bearers: string[] = []
  const tables: readonly (readonly [string, readonly Property[]])[] = [
    ['node', doc.getRoot().listNodes()],
    ['mesh', doc.getRoot().listMeshes()],
    ['material', doc.getRoot().listMaterials()],
    ['camera', doc.getRoot().listCameras()],
    ['animation', doc.getRoot().listAnimations()],
    ['accessor', doc.getRoot().listAccessors()],
    ['buffer', doc.getRoot().listBuffers()],
    ['scene', doc.getRoot().listScenes()],
  ]
  for (const [table, properties] of tables) {
    for (const property of properties) {
      const extras = property.getExtras()
      if (extras !== null && Object.keys(extras).length > 0) {
        bearers.push(`${table} ${property.getName() || '(unnamed)'}`)
      }
    }
  }
  return bearers
}
