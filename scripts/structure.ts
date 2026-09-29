// The structure facts of the Blender naming contract:
// PART_ meshes, HS_ empties parented to their part, CAM_ cameras,
// KHR_materials_variants, and exactly one Explode animation. Reading them
// resolves HS_ parents by name, past the unnamed wrapper nodes that Meshopt
// quantization inserts, so nothing depends on mesh placement.
import type { Document, Node } from '@gltf-transform/core'
import { KHRMaterialsVariants, type MappingList } from '@gltf-transform/extensions'

export const HOTSPOT_PREFIX = 'HS_'
export const CAMERA_PREFIX = 'CAM_'
export const EXPLODE_CLIP_NAME = 'Explode'

export type HotspotAnchor = {
  name: string
  // The nearest named ancestor: the PART_ node the hotspot rides with.
  // null when the hotspot hangs directly in the scene root.
  parentName: string | null
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
  const unlitMaterialNames: string[] = []
  const occlusionMaterialNames: string[] = []
  for (const material of root.listMaterials()) {
    if (material.getExtension('KHR_materials_unlit') !== null) {
      unlitMaterialNames.push(material.getName())
    }
    if (material.getOcclusionTexture() !== null) {
      occlusionMaterialNames.push(material.getName())
    }
  }
  return {
    nodeNames: root.listNodes().map((node) => node.getName()).filter((name) => name !== ''),
    hotspotAnchors: root.listNodes().filter(isHotspotNode).map((node) => ({
      name: node.getName(),
      parentName: nearestNamedAncestor(node),
    })),
    cameraNames: root
      .listNodes()
      .filter((node) => node.getCamera() !== null)
      .map((node) => node.getName()),
    variantNames: variantsExtension.listVariants().map((variant) => variant.getName()),
    mappingCount: readMappingCount(doc),
    animationNames: root.listAnimations().map((animation) => animation.getName()),
    unlitMaterialNames,
    occlusionMaterialNames,
  }
}

function countByName(anchors: readonly HotspotAnchor[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const anchor of anchors) {
    counts.set(anchor.name, (counts.get(anchor.name) ?? 0) + 1)
  }
  return counts
}

function describeParent(parentName: string | null): string {
  return parentName ?? 'scene root'
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

// The clip rule on its own: exactly one animation, named Explode. The
// Blender exporter turns any extra action into an extra clip, so the check
// fails loudly instead of letting the site scrub the wrong one.
export function findExplodeClipViolations(structure: ProductStructure): string[] {
  const violations: string[] = []
  const explodeCount = structure.animationNames.filter((name) => name === EXPLODE_CLIP_NAME).length
  if (explodeCount !== 1) {
    violations.push(`expected exactly one '${EXPLODE_CLIP_NAME}' animation, found ${explodeCount}`)
  }
  for (const name of structure.animationNames) {
    if (name !== EXPLODE_CLIP_NAME) {
      violations.push(`unexpected animation: ${name}`)
    }
  }
  return violations
}
