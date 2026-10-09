// The home-fit facts of a product document, read the way the viewer reads
// them: the stored vertex positions of the poses the home view must hold,
// as world-space points, posed by the stored transforms and keys. The
// home-fit rule projects these points through the authored home camera.
// One pass over the document, plain data out, so the rule stays a pure
// function.

import type { Document, Node } from '@gltf-transform/core'
import { PART_PREFIX, SHADOW_NODE_NAME } from '../src/lib/product/contractNames.ts'
import { transformPointOf } from '../src/lib/camera/frame.ts'
import type { Mat4, Vec3 } from '../src/lib/camera/frame.ts'
import { posedWorldMatricesOf } from './nodePoses.ts'
import { nearestNamedAncestorOf } from './contractPrimitiveFacts.ts'
import type { ChannelFact } from './animationFacts.ts'

// The stored vertices of one pose, as world-space points with the mesh
// node each point came from, so a violation can name the part that binds.
export type PosePoints = {
  readonly points: readonly Vec3[]
  readonly nodeNames: readonly string[]
}

// The home-fit facts of a document, or the problem that keeps the document
// from having them: a fact of the file the rule reports, never a throw.
export type HomeFitFacts =
  MeasuredHomeFitFacts | { readonly kind: 'problem'; readonly reason: string }

export type MeasuredHomeFitFacts = {
  readonly kind: 'measured'
  // Every PART_ mesh plus the SHADOW subtree, at the rest pose.
  readonly assembled: PosePoints
  // Every PART_ mesh at the clip's last key: the shadow has faded out by
  // then, exactly as the viewer presents the explode's end.
  readonly exploded: PosePoints
}

// Reads the home-fit facts. Positions decode the way the glTF core decodes
// any accessor storage, so a file stored another way than the pipeline
// writes it still measures; its storage is the storage rule's violation.
export function readHomeFitFacts(doc: Document, channels: readonly ChannelFact[]): HomeFitFacts {
  const rest = posedWorldMatricesOf(doc, [])
  const exploded = posedWorldMatricesOf(doc, channels)
  const assembled = posePointsOf(doc, rest, (node) => isPartOwned(node) || inShadowSubtree(node))
  if (assembled.points.length === 0) {
    return { kind: 'problem', reason: 'the assembled pose holds no stored vertices' }
  }
  const explodedPoints = posePointsOf(doc, exploded, isPartOwned)
  if (explodedPoints.points.length === 0) {
    return { kind: 'problem', reason: 'the exploded pose holds no stored vertices' }
  }
  return { kind: 'measured', assembled, exploded: explodedPoints }
}

function posePointsOf(
  doc: Document,
  worlds: ReadonlyMap<Node, Mat4>,
  keep: (node: Node) => boolean,
): PosePoints {
  const points: Vec3[] = []
  const nodeNames: string[] = []
  for (const node of meshNodesOf(doc)) {
    if (!keep(node)) {
      continue
    }
    const world = worlds.get(node)
    if (world === undefined) {
      continue
    }
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute('POSITION')
      if (position === null) {
        continue
      }
      // The name the violation reports: the mesh node's own name, or its
      // nearest named ancestor when quantization wrapped it, the way the
      // hotspot and bounds readers resolve a node.
      const name = node.getName() !== '' ? node.getName() : nearestNamedAncestorOf(node)
      const count = position.getCount()
      const element = [0, 0, 0]
      for (let i = 0; i < count; i += 1) {
        position.getElement(i, element)
        const local: Vec3 = [element[0] ?? 0, element[1] ?? 0, element[2] ?? 0]
        points.push(transformPointOf(world, local))
        nodeNames.push(name)
      }
    }
  }
  return { points, nodeNames }
}

function meshNodesOf(doc: Document): Node[] {
  return doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh() !== null)
}

function isPartOwned(node: Node): boolean {
  return hasAncestorName(node, (name) => name.startsWith(PART_PREFIX))
}

function inShadowSubtree(node: Node): boolean {
  return hasAncestorName(node, (name) => name === SHADOW_NODE_NAME)
}

function hasAncestorName(node: Node, matches: (name: string) => boolean): boolean {
  for (let current: Node | null = node; current !== null; current = current.getParentNode()) {
    if (matches(current.getName())) {
      return true
    }
  }
  return false
}
