// The home-fit facts of a product document, read the way the viewer reads
// them: the stored vertex positions of the poses the home view must hold,
// as world-space points, and the world scale of the node chains that turn
// a stored component error into a world one. The home-fit rule projects
// these points through the authored home camera; the storage bound of the
// file multiplies through the scales. One pass over the document, plain
// data out, so the rule stays a pure function.

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
  // The largest world scale over the posed mesh nodes' chains: the factor
  // a normalized component error grows by on its way to world space.
  readonly sigmaMax: number
  // The world scale of every animated node's parent chain, by node name:
  // the factor a stored translation key error grows by.
  readonly parentSigmaByName: ReadonlyMap<string, number>
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
  const parentSigmaByName = parentSigmasOf(doc, channels, rest)
  if (typeof parentSigmaByName === 'string') {
    return { kind: 'problem', reason: parentSigmaByName }
  }
  const sigmaMax = Math.max(
    0,
    ...meshNodesOf(doc)
      .filter((node) => isPartOwned(node) || inShadowSubtree(node))
      .map((node) => worldSigmaOf(rest.get(node) ?? IDENTITY)),
  )
  return {
    kind: 'measured',
    assembled,
    exploded: explodedPoints,
    sigmaMax,
    parentSigmaByName,
  }
}

// The world scale of every animated node's parent chain, by node name, or
// the problem that keeps a channel's chain from being read.
function parentSigmasOf(
  doc: Document,
  channels: readonly ChannelFact[],
  rest: ReadonlyMap<Node, Mat4>,
): ReadonlyMap<string, number> | string {
  const parentSigmaByName = new Map<string, number>()
  for (const channel of channels) {
    if (parentSigmaByName.has(channel.targetName)) {
      continue
    }
    const node = doc
      .getRoot()
      .listNodes()
      .find((candidate) => candidate.getName() === channel.targetName)
    if (node === undefined) {
      return `the clip drives '${channel.targetName}', which the document holds no node for`
    }
    const parent = node.getParentNode()
    if (parent !== null && !rest.has(parent)) {
      return `the parent of the animated node '${channel.targetName}' is outside the document's scene`
    }
    parentSigmaByName.set(
      channel.targetName,
      parent === null ? 1 : worldSigmaOf(rest.get(parent) ?? IDENTITY),
    )
  }
  return parentSigmaByName
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

// The largest world scale of one world matrix's linear part: the largest
// singular value, from the largest eigenvalue of the linear part's
// Gram matrix (a symmetric 3x3), in closed form. A rigid chain answers
// its uniform scale; a stretched one its largest stretch, which is the
// growth a unit error can pick up.
export function worldSigmaOf(matrix: Mat4): number {
  const m00 = matrix[0] ?? 0
  const m01 = matrix[1] ?? 0
  const m02 = matrix[2] ?? 0
  const m10 = matrix[4] ?? 0
  const m11 = matrix[5] ?? 0
  const m12 = matrix[6] ?? 0
  const m20 = matrix[8] ?? 0
  const m21 = matrix[9] ?? 0
  const m22 = matrix[10] ?? 0
  // Gram matrix M^T M, symmetric: [a b c; b d e; c e f].
  const a = m00 * m00 + m10 * m10 + m20 * m20
  const b = m00 * m01 + m10 * m11 + m20 * m21
  const c = m00 * m02 + m10 * m12 + m20 * m22
  const d = m01 * m01 + m11 * m11 + m21 * m21
  const e = m01 * m02 + m11 * m12 + m21 * m22
  const f = m02 * m02 + m12 * m12 + m22 * m22
  const largest = largestEigenvalueOfSymmetric3x3(a, b, c, d, e, f)
  return Math.sqrt(Math.max(largest, 0))
}

// The largest eigenvalue of a symmetric 3x3 matrix, by the trigonometric
// solution of its characteristic polynomial: deterministic, no iteration.
function largestEigenvalueOfSymmetric3x3(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): number {
  const p1 = b * b + c * c + e * e
  if (p1 === 0) {
    return Math.max(a, d, f)
  }
  const q = (a + d + f) / 3
  const p2 = (a - q) * (a - q) + (d - q) * (d - q) + (f - q) * (f - q) + 2 * p1
  const p = Math.sqrt(p2 / 6)
  const inv = 1 / p
  // B = (M - q I) / p, half its trace is r, phi the eigenvalue angle.
  const bb = (a - q) * inv
  const dd = (d - q) * inv
  const ff = (f - q) * inv
  const r =
    (bb * dd * ff +
      2 * b * c * e * inv * inv * inv -
      bb * e * e * inv -
      dd * c * c * inv -
      ff * b * b * inv) /
    2
  const clamped = Math.min(1, Math.max(-1, r))
  const phi = Math.acos(clamped) / 3
  return q + 2 * p * Math.cos(phi)
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

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
