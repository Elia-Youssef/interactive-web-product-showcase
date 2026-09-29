import { Camera, type AnimationClip, type Object3D } from 'three'
import {
  CAMERA_HOME_ID,
  CAMERA_PREFIX,
  HOTSPOT_PREFIX,
  PART_PREFIX,
  SHADOW_NODE_NAME,
  type Product,
} from '@lib/product'
import { jsonNodeNames, readVariantNames } from './gltfJson'
import type { ProductRig, ProductHotspot } from './productRig'
import { ProductRigError, type RigProblem } from './rigError'

// What the parse reads the rig from: the loaded glTF result, kept
// structural so tests build it from plain trees.
export type ProductSource = {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
  // The raw glTF JSON the loader's parser holds; the variants extension
  // lives here, not on the scene graph.
  readonly json: unknown
}

// The named nodes of one scene, classified by the contract prefixes. The
// counts keep the duplicate check exact: one node per name is the contract,
// so a repeated name is a problem even when every other part checks out.
// firstByName holds the first node of each name, read only for names the
// duplicate check let through.
type NamedNodes = {
  nameCounts: Map<string, number>
  firstByName: Map<string, Object3D>
  parts: Object3D[]
  hotspotAnchors: Object3D[]
  cameras: Object3D[]
  shadows: Object3D[]
}

// Parses the loaded product into its rig, or fails with one ProductRigError
// listing every contract problem the model has. This is the runtime
// guarantee every later feature reads; the validate step checks the same
// contract at build time.
//
// The contract names are the node table of the glTF JSON, the same facts
// the validate step reads. The runtime graph cannot be trusted for them
// alone: the loader names every mesh object after its mesh definition, so
// the quantize wrapper of PART_base arrives as a scene node named
// PART_base_1, which is not a contract node but a load artifact.
export function parseProductRig(source: ProductSource, manifest: Product): ProductRig {
  const nodes = collectNamedNodes(source.scene, jsonNodeNames(source.json))
  const problems: RigProblem[] = [...duplicateNameProblems(nodes)]

  const { hotspots, problems: hotspotProblems } = resolveHotspots(manifest, nodes)
  const { cameras, problems: cameraProblems } = resolveCameras(manifest, nodes)
  problems.push(...hotspotProblems, ...cameraProblems)

  const shadow = resolveShadow(nodes, problems)
  const clip = resolveClip(source.animations, manifest.explode.clip, problems)
  const parts = new Map(nodes.parts.map((node) => [node.name, node]))

  if (problems.length > 0) {
    throw new ProductRigError(manifest.slug, problems)
  }
  return {
    parts,
    hotspots,
    cameras,
    shadow: present(shadow, 'the shadow node'),
    clip: present(clip, 'the explode clip'),
    variants: readVariantNames(source.json),
  }
}

// Every resolver that can return null reports the problem that made it do
// so, so an empty problem list means every value below is present. The
// guard keeps the parse total without an assertion.
function present<T>(value: T | null, describe: string): T {
  if (value === null) {
    throw new Error(`internal error: ${describe} was not resolved but no problem was reported`)
  }
  return value
}

// Collects the scene nodes that carry a contract name, classified by the
// contract prefixes. The counts keep the duplicate check exact: one node
// per name is the contract, so a repeated name is a problem even when every
// other part checks out.
function collectNamedNodes(scene: Object3D, contractNames: ReadonlySet<string>): NamedNodes {
  const nodes: NamedNodes = {
    nameCounts: new Map(),
    firstByName: new Map(),
    parts: [],
    hotspotAnchors: [],
    cameras: [],
    shadows: [],
  }
  scene.traverse((node) => {
    if (node.name === '' || !contractNames.has(node.name)) {
      return
    }
    nodes.nameCounts.set(node.name, (nodes.nameCounts.get(node.name) ?? 0) + 1)
    if (!nodes.firstByName.has(node.name)) {
      nodes.firstByName.set(node.name, node)
    }
    if (node.name.startsWith(PART_PREFIX)) {
      nodes.parts.push(node)
    }
    if (node.name.startsWith(HOTSPOT_PREFIX)) {
      nodes.hotspotAnchors.push(node)
    }
    if (node.name.startsWith(CAMERA_PREFIX)) {
      nodes.cameras.push(node)
    }
    if (node.name === SHADOW_NODE_NAME) {
      nodes.shadows.push(node)
    }
  })
  return nodes
}

function duplicateNameProblems(nodes: NamedNodes): RigProblem[] {
  const problems: RigProblem[] = []
  const contractNames = new Set([
    ...nodes.parts.map((node) => node.name),
    ...nodes.hotspotAnchors.map((node) => node.name),
    ...nodes.cameras.map((node) => node.name),
    ...nodes.shadows.map((node) => node.name),
  ])
  for (const name of contractNames) {
    const count = nodes.nameCounts.get(name) ?? 0
    if (count > 1) {
      problems.push({
        node: name,
        message: `node name '${name}' appears ${count} times, the contract needs one node per name`,
      })
    }
  }
  return problems
}

// Walks up from a node to its nearest named ancestor, skipping the unnamed
// wrapper nodes quantization adds. Returns null at the scene root.
function nearestNamedAncestor(node: Object3D): Object3D | null {
  let parent = node.parent
  while (parent !== null) {
    if (parent.name !== '') {
      return parent
    }
    parent = parent.parent
  }
  return null
}

function resolveHotspots(
  manifest: Product,
  nodes: NamedNodes,
): { hotspots: ProductHotspot[]; problems: RigProblem[] } {
  const hotspots: ProductHotspot[] = []
  const problems: RigProblem[] = []
  for (const hotspot of manifest.hotspots) {
    const name = `${HOTSPOT_PREFIX}${hotspot.id}`
    const anchor = firstOf(nodes, name)
    if (anchor === undefined) {
      problems.push({ node: name, message: `no ${name} node for manifest hotspot '${hotspot.id}'` })
      continue
    }
    const parent = nearestNamedAncestor(anchor)
    if (parent === null) {
      problems.push({
        node: name,
        message: `hotspot ${name} hangs in the scene root, expected a ${PART_PREFIX} node`,
      })
      continue
    }
    if (!parent.name.startsWith(PART_PREFIX)) {
      problems.push({
        node: name,
        message: `hotspot ${name} is parented to '${parent.name}', expected a ${PART_PREFIX} node`,
      })
      continue
    }
    hotspots.push({ id: hotspot.id, node: anchor, part: parent })
  }
  return { hotspots, problems }
}

function resolveCameras(
  manifest: Product,
  nodes: NamedNodes,
): { cameras: Map<string, Camera>; problems: RigProblem[] } {
  const cameras = new Map<string, Camera>()
  const problems: RigProblem[] = []
  const homeName = `${CAMERA_PREFIX}${CAMERA_HOME_ID}`
  const home = firstOf(nodes, homeName)
  if (home === undefined) {
    problems.push({
      node: homeName,
      message: `no ${homeName} node, the start and reset view is required`,
    })
  } else {
    resolveCameraNode(cameras, CAMERA_HOME_ID, home, problems)
  }
  for (const hotspot of manifest.hotspots) {
    const node = firstOf(nodes, `${CAMERA_PREFIX}${hotspot.id}`)
    // A per-hotspot camera is optional; the rig carries the ones the model has.
    if (node !== undefined) {
      resolveCameraNode(cameras, hotspot.id, node, problems)
    }
  }
  return { cameras, problems }
}

// A CAM_ node must carry the camera object the contract names; a plain node
// under the name cannot serve a view and is a problem of its own.
function resolveCameraNode(
  cameras: Map<string, Camera>,
  id: string,
  node: Object3D,
  problems: RigProblem[],
): void {
  const name = `${CAMERA_PREFIX}${id}`
  if (!(node instanceof Camera)) {
    problems.push({ node: name, message: `${name} does not carry a camera object` })
    return
  }
  cameras.set(id, node)
}

function resolveShadow(nodes: NamedNodes, problems: RigProblem[]): Object3D | null {
  const shadow = nodes.shadows[0]
  if (shadow === undefined) {
    problems.push({
      node: SHADOW_NODE_NAME,
      message: `no ${SHADOW_NODE_NAME} node, the baked contact shadow is required`,
    })
    return null
  }
  return shadow
}

// The one-clip rule with a name: exactly one animation named by the
// manifest's explode block, and no other animation besides it.
function resolveClip(
  animations: readonly AnimationClip[],
  clipName: string,
  problems: RigProblem[],
): AnimationClip | null {
  const named = animations.filter((clip) => clip.name === clipName)
  if (named.length !== 1) {
    problems.push({
      node: null,
      message: `expected exactly one '${clipName}' animation, found ${named.length}`,
    })
  }
  for (const clip of animations) {
    if (clip.name !== clipName) {
      problems.push({ node: null, message: `unexpected animation: '${clip.name}'` })
    }
  }
  return named[0] ?? null
}

// The first node of a contract name. Duplicate names are their own problem,
// reported above, so the first is only ever read when the name is unique.
function firstOf(nodes: NamedNodes, name: string): Object3D | undefined {
  return nodes.firstByName.get(name)
}
