// The structure facts of the Blender naming contract:
// PART_ meshes, HS_ empties parented to their part, CAM_ cameras,
// KHR_materials_variants, and exactly one Explode animation. Reading them
// resolves HS_ parents by name, past the unnamed wrapper nodes that Meshopt
// quantization inserts, so nothing depends on mesh placement.
import type { Document, Node } from '@gltf-transform/core'
import { KHRMaterialsVariants, type Anisotropy, type MappingList } from '@gltf-transform/extensions'
import { HOTSPOT_PREFIX } from '../src/lib/product/contractNames.ts'
import { readCameraFacts, readGeometryFacts, readMeshBoxes } from './modelFacts.ts'
import type { CameraFact, GeometryFacts } from './modelFacts.ts'
import { isMat4, transformPointOf } from '../src/lib/camera/frame.ts'
import type { MeshBox, Vec3 } from '../src/lib/camera/frame.ts'

// The extension a file must carry to prove the optimize step ran its
// Meshopt pass. The reader decodes the compressed accessors, so the
// primitive-level markers are consumed; the document keeps the extension
// listed (and required) and that is the fact the checks read.
export const MESHOPT_EXTENSION = 'EXT_meshopt_compression'

export type HotspotAnchor = {
  name: string
  // The nearest named ancestor: the PART_ node the hotspot rides with.
  // null when the hotspot hangs directly in the scene root.
  parentName: string | null
  // The anchor's rest position, in the document's model space: the origin
  // of its world matrix as the document authors it, before any animation.
  // null when the world matrix is not a finite 4x4 matrix, which the
  // hotspot check reports, so the position is never guessed.
  restPosition: Vec3 | null
}

export type ProductStructure = {
  nodeNames: string[]
  hotspotAnchors: HotspotAnchor[]
  cameraNames: string[]
  variantNames: string[]
  mappingCount: number
  animationNames: string[]
  unlitMaterialNames: string[]
  occlusionMaterialNames: string[]
  // The materials whose anisotropy reads through a texture: the one
  // anisotropy form the render contract does not support, so the validate
  // step rejects it and an authored strength stays the only way in.
  anisotropyTextureMaterialNames: string[]
  meshoptCompressed: boolean
  // The camera, mesh and geometry facts the camera and model contracts'
  // rules read, as plain data; the document itself never leaves the model
  // step. The camera names derive from the same camera facts, so one read
  // answers both.
  cameraFacts: CameraFact[]
  geometry: GeometryFacts
  meshBoxes: MeshBox[]
}

export function isHotspotNode(node: Node): boolean {
  return node.getName().startsWith(HOTSPOT_PREFIX)
}

// Walks up from a node to its nearest named ancestor, skipping the unnamed
// wrapper nodes quantization adds. Returns null at the scene root.
export function nearestNamedAncestor(node: Node): string | null {
  let parent = node.getParentNode()
  while (parent !== null) {
    const name = parent.getName()
    if (name !== '') {
      return name
    }
    parent = parent.getParentNode()
  }
  return null
}

// Names a hotspot parent for people: the node name, or the scene root when
// the hotspot hangs free.
export function describeParent(parentName: string | null): string {
  return parentName ?? 'scene root'
}

function readMappingCount(doc: Document): number {
  let count = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const mappingList = primitive.getExtension<MappingList>('KHR_materials_variants')
      if (mappingList === null) {
        continue
      }
      count += mappingList.listMappings().length
    }
  }
  return count
}

export function readProductStructure(doc: Document): ProductStructure {
  const root = doc.getRoot()
  const variantsExtension = doc.createExtension(KHRMaterialsVariants)
  const cameraFacts = readCameraFacts(doc)
  const unlitMaterialNames: string[] = []
  const occlusionMaterialNames: string[] = []
  const anisotropyTextureMaterialNames: string[] = []
  for (const material of root.listMaterials()) {
    if (material.getExtension('KHR_materials_unlit') !== null) {
      unlitMaterialNames.push(material.getName())
    }
    if (material.getOcclusionTexture() !== null) {
      occlusionMaterialNames.push(material.getName())
    }
    const anisotropy = material.getExtension<Anisotropy>('KHR_materials_anisotropy')
    if (anisotropy !== null && anisotropy.getAnisotropyTexture() !== null) {
      anisotropyTextureMaterialNames.push(material.getName())
    }
  }
  return {
    nodeNames: root
      .listNodes()
      .map((node) => node.getName())
      .filter((name) => name !== ''),
    hotspotAnchors: readHotspotAnchors(doc),
    cameraNames: cameraFacts.map((fact) => fact.name),
    variantNames: variantsExtension.listVariants().map((variant) => variant.getName()),
    mappingCount: readMappingCount(doc),
    animationNames: root.listAnimations().map((animation) => animation.getName()),
    unlitMaterialNames,
    occlusionMaterialNames,
    anisotropyTextureMaterialNames,
    meshoptCompressed: root
      .listExtensionsUsed()
      .some((extension) => extension.extensionName === MESHOPT_EXTENSION),
    cameraFacts,
    geometry: readGeometryFacts(doc),
    meshBoxes: readMeshBoxes(doc),
  }
}

// Every HS_ node of the document, in node order, with the part it rides
// and its rest position.
export function readHotspotAnchors(doc: Document): HotspotAnchor[] {
  return doc
    .getRoot()
    .listNodes()
    .filter(isHotspotNode)
    .map((node) => ({
      name: node.getName(),
      parentName: nearestNamedAncestor(node),
      restPosition: restPositionOf(node),
    }))
}

// The rest position of a node: its world matrix's origin, read only from a
// finite 4x4 matrix. The transform is the shared point transform every
// document fact uses, so an anchor reads the way a camera position does.
function restPositionOf(node: Node): Vec3 | null {
  const matrix = node.getWorldMatrix()
  if (!isMat4(matrix) || !matrix.every((element) => Number.isFinite(element))) {
    return null
  }
  return transformPointOf(matrix, [0, 0, 0])
}

// The rest position of every hotspot anchor with a readable one, keyed by
// the hotspot id after the HS_ prefix: the anchors the close-up views
// orbit. An anchor without a readable rest is left out, so the pivot rule
// reports its close-up instead of orbiting a guessed point.
export function anchorRestsOf(anchors: readonly HotspotAnchor[]): ReadonlyMap<string, Vec3> {
  const rests = new Map<string, Vec3>()
  for (const anchor of anchors) {
    if (anchor.restPosition !== null) {
      rests.set(anchor.name.slice(HOTSPOT_PREFIX.length), anchor.restPosition)
    }
  }
  return rests
}

function countByName(anchors: readonly HotspotAnchor[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const anchor of anchors) {
    counts.set(anchor.name, (counts.get(anchor.name) ?? 0) + 1)
  }
  return counts
}

function isDuplicatedIn(counts: Map<string, number>, name: string): boolean {
  return (counts.get(name) ?? 0) > 1
}

// The anchors whose name appears exactly once on their side, keyed by name.
// A duplicated HS_ name never enters the comparison: it is its own violation
// below, so one name can never stand for two anchors.
function uniqueAnchorsByName(anchors: readonly HotspotAnchor[]): Map<string, HotspotAnchor> {
  const counts = countByName(anchors)
  const unique = new Map<string, HotspotAnchor>()
  for (const anchor of anchors) {
    if (counts.get(anchor.name) === 1) {
      unique.set(anchor.name, anchor)
    }
  }
  return unique
}

// Compares the hotspots by name and parent name. A duplicated HS_ name is
// itself a contract violation, reported as such, never merged by a count;
// every unique name must keep its parent.
function findHotspotLosses(
  beforeAnchors: readonly HotspotAnchor[],
  afterAnchors: readonly HotspotAnchor[],
): string[] {
  const losses: string[] = []
  const beforeCounts = countByName(beforeAnchors)
  const afterCounts = countByName(afterAnchors)
  for (const [name, count] of beforeCounts) {
    if (count > 1) {
      losses.push(`hotspot name duplicated in the source: ${name} appears ${count} times`)
    }
  }
  for (const [name, count] of afterCounts) {
    if (count > 1) {
      losses.push(`hotspot name duplicated in the output: ${name} appears ${count} times`)
    }
  }
  const before = uniqueAnchorsByName(beforeAnchors)
  const after = uniqueAnchorsByName(afterAnchors)
  for (const [name, anchor] of before) {
    if (isDuplicatedIn(afterCounts, name)) {
      // The duplication report owns this name; comparing it would only cry
      // "lost" on top of the violation.
      continue
    }
    const afterAnchor = after.get(name)
    if (afterAnchor === undefined) {
      losses.push(`hotspot lost: ${name} (was under ${describeParent(anchor.parentName)})`)
    } else if (afterAnchor.parentName !== anchor.parentName) {
      losses.push(
        `hotspot ${name} moved: was under ${describeParent(anchor.parentName)}, ` +
          `now under ${describeParent(afterAnchor.parentName)}`,
      )
    }
  }
  return losses
}

// Compares the structure of an optimized file against its source. Returns
// every violation, so one pass reports the whole class of losses: a
// vanished node name, a moved hotspot parent, a lost camera, variant or
// mapping.
export function findStructureLosses(before: ProductStructure, after: ProductStructure): string[] {
  const losses: string[] = []
  for (const name of before.nodeNames) {
    if (!after.nodeNames.includes(name)) {
      losses.push(`node name lost: ${name}`)
    }
  }
  for (const name of after.nodeNames) {
    if (!before.nodeNames.includes(name)) {
      losses.push(`unexpected node name: ${name}`)
    }
  }
  losses.push(...findHotspotLosses(before.hotspotAnchors, after.hotspotAnchors))
  for (const cameraName of before.cameraNames) {
    if (!after.cameraNames.includes(cameraName)) {
      losses.push(`camera lost: ${cameraName}`)
    }
  }
  if (before.variantNames.join('\n') !== after.variantNames.join('\n')) {
    losses.push(
      `variants changed: [${before.variantNames.join(', ')}] -> [${after.variantNames.join(', ')}]`,
    )
  }
  if (before.mappingCount !== after.mappingCount) {
    losses.push(`variant mappings changed: ${before.mappingCount} -> ${after.mappingCount}`)
  }
  for (const name of before.animationNames) {
    if (!after.animationNames.includes(name)) {
      losses.push(`animation lost: ${name}`)
    }
  }
  return losses
}

// The one-clip rule without a name: exactly one animation, whatever it is
// called. The optimize step has no manifest, so no clip name to check; the
// structure comparison above already keeps the name from changing.
export function findSingleAnimationViolations(structure: ProductStructure): string[] {
  const count = structure.animationNames.length
  if (count === 1) {
    return []
  }
  return [`expected exactly one animation, found ${count}`]
}

// The clip rule with a name: exactly one animation, named by the given clip
// name. The Blender exporter turns any extra action into an extra clip, so
// the check fails loudly instead of letting the site scrub the wrong one.
// The validate step checks the clip the parsed manifest carries.
export function findExplodeClipViolations(structure: ProductStructure, clipName: string): string[] {
  const violations: string[] = []
  const explodeCount = structure.animationNames.filter((name) => name === clipName).length
  if (explodeCount !== 1) {
    violations.push(`expected exactly one '${clipName}' animation, found ${explodeCount}`)
  }
  for (const name of structure.animationNames) {
    if (name !== clipName) {
      violations.push(`unexpected animation: ${name}`)
    }
  }
  return violations
}
