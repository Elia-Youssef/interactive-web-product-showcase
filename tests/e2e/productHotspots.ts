import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBounds, type mat4, type Node as GltfNode, type vec3 } from '@gltf-transform/core'
import type { Product } from '../../src/lib/product'
import { HOTSPOT_PREFIX } from '../../src/lib/product/contractNames.ts'
import { createModelIO } from '../../scripts/modelIo.ts'
import { isBlocked, readOccluderMeshes, type Triangle } from './productMesh'

// The authored hotspot facts of a shipped product, computed in Node straight
// from the `.glb` the site ships. The spec derives its geometry expectations
// from these facts, never from the viewer's own scene graph, so a viewer
// regression cannot hide behind its own helpers. The stage space is the one
// the runtime presents: the model centered by the bounding box center, the
// same center the camera facts read.
//
// The hiding-height search raycasts the shipped meshes themselves, so the
// facts carry what the runtime's occluders see: the occluders are every mesh
// except the shadow plane, and the search finds a camera height from which
// the opposite-side ray to one anchor is blocked by them while every other
// anchor's ray stays clear, across the orbit's distance range and the
// azimuth tolerance the drive lands within.

export type ProductHotspotFact = {
  readonly id: string
  readonly stagePosition: vec3
  // The camera height in stage space from which the opposite-azimuth ray to
  // this anchor is blocked by the shipped meshes while every other anchor's
  // ray is clear, or null when no such height exists in the searched band.
  readonly hidingHeightM: number | null
}

export type ProductHotspotFacts = {
  readonly hotspots: readonly ProductHotspotFact[]
  // The bounds of the occluding meshes, the shadow plane excluded, in stage
  // space: the body the occlusion argument is checked against.
  readonly occluderBounds: { readonly min: vec3; readonly max: vec3 }
  // The occluding meshes' stage-space triangles, the ones the runtime's
  // occluder raycast sees.
  readonly occluders: readonly Triangle[]
}

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The search band for the hiding camera height, in stage space, and its
// step. The band spans the orbit's own height range around the model; the
// step is two orders below the band, so the chosen middle of a run sits
// within the step of the run's true edge.
const SEARCH_MIN_Y_M = -0.6
const SEARCH_MAX_Y_M = 0.6
const SEARCH_STEP_M = 0.005

// The orbit distances and azimuth offsets the hiding height must hold
// across. The azimuth and polar drives never dolly, so the distance stays
// at the presented home distance; the spread covers the drive's landing and
// the controls' small dolly wobble around it. The azimuth drive lands
// within ten degrees of the opposite azimuth. A height that holds
// across this spread is a hiding height of the view the spec drives, not of
// one exact camera pose.
const DISTANCE_FACTORS = [0.95, 1.0, 1.05, 1.1, 1.2]
const AZIMUTH_OFFSETS_RAD = [-Math.PI / 18, -Math.PI / 36, 0, Math.PI / 36, Math.PI / 18]

export async function readProductHotspotFacts(
  slug: string,
  manifest: Product,
): Promise<ProductHotspotFacts> {
  const io = await createModelIO()
  const modelPath = path.join(ROOT, 'public', 'models', slug, 'model.glb')
  const doc = await io.read(modelPath)
  const root = doc.getRoot()

  const scene = root.listScenes()[0]
  if (scene === undefined) {
    throw new Error(`no scene in ${modelPath}`)
  }
  const sceneBounds = getBounds(scene)
  const center: vec3 = [
    (sceneBounds.min[0] + sceneBounds.max[0]) / 2,
    (sceneBounds.min[1] + sceneBounds.max[1]) / 2,
    (sceneBounds.min[2] + sceneBounds.max[2]) / 2,
  ]
  const meshes = readOccluderMeshes(doc, center)

  // The authored home view: its orbit target and distance, which the hiding
  // height's orbit poses hang from.
  const homeNode = findNode(root.listNodes(), 'CAM_home', modelPath)
  const homeWorld = homeNode.getWorldMatrix()
  const homePosition = subtract(transformPoint(homeWorld, [0, 0, 0]), center)
  const homeForward = normalize(transformDirection(homeWorld, [0, 0, -1]))
  const homeTarget = closestPointOnRay(homePosition, homeForward, [0, 0, 0])
  const homeDistance = length(subtract(homePosition, homeTarget))

  const anchors = readAnchors(root.listNodes(), manifest, center, modelPath)

  const hotspots = anchors.map((anchor, index) => {
    const others = anchors.filter((_, candidateIndex) => candidateIndex !== index)
    return {
      id: anchor.id,
      stagePosition: anchor.stagePosition,
      hidingHeightM: hidingHeightFor(anchor.stagePosition, others, {
        triangles: meshes.triangles,
        homeTarget,
        homeDistance,
      }),
    }
  })

  return {
    hotspots,
    occluderBounds: { min: meshes.min, max: meshes.max },
    occluders: meshes.triangles,
  }
}

// Every manifest hotspot's HS_ anchor in stage space, in manifest order.
function readAnchors(
  nodes: readonly GltfNode[],
  manifest: Product,
  center: vec3,
  modelPath: string,
): readonly { readonly id: string; readonly stagePosition: vec3 }[] {
  return manifest.hotspots.map((hotspot) => {
    const node = findNode(nodes, `${HOTSPOT_PREFIX}${hotspot.id}`, modelPath)
    return {
      id: hotspot.id,
      stagePosition: subtract(transformPoint(node.getWorldMatrix(), [0, 0, 0]), center),
    }
  })
}

function findNode(nodes: readonly GltfNode[], name: string, modelPath: string): GltfNode {
  const node = nodes.find((candidate) => candidate.getName() === name)
  if (node === undefined) {
    throw new Error(`no ${name} node in ${modelPath}`)
  }
  return node
}

// The camera height from which the anchor's opposite-azimuth ray is blocked
// by the shipped meshes while every other anchor's ray is clear, across the
// orbit spread. The scan walks the band and answers the middle of the
// largest contiguous run of holding heights, so the landed view sits inside
// the run with the run's own margin on both sides.
function hidingHeightFor(
  anchor: vec3,
  others: readonly { readonly id: string; readonly stagePosition: vec3 }[],
  context: HidingContext,
): number | null {
  const azimuth = Math.atan2(
    -(anchor[0] - context.homeTarget[0]),
    -(anchor[2] - context.homeTarget[2]),
  )
  const holding: number[] = []
  for (let height = SEARCH_MIN_Y_M; height <= SEARCH_MAX_Y_M; height += SEARCH_STEP_M) {
    if (hidesAnchorButOthers(anchor, others, azimuth, height, context)) {
      holding.push(height)
    }
  }
  return widestRunMiddle(holding)
}

// The middle of the largest contiguous run of the sorted heights, or null
// when nothing holds.
function widestRunMiddle(holding: readonly number[]): number | null {
  if (holding.length === 0) {
    return null
  }
  let bestStart = 0
  let bestLength = 1
  let runStart = 0
  let runLength = 1
  for (let index = 1; index < holding.length; index += 1) {
    const previous = holding[index - 1]
    const current = holding[index]
    if (
      previous !== undefined &&
      current !== undefined &&
      Math.abs(current - previous) <= SEARCH_STEP_M * 1.5
    ) {
      runLength += 1
    } else {
      runStart = index
      runLength = 1
    }
    if (runLength > bestLength) {
      bestStart = runStart
      bestLength = runLength
    }
  }
  const first = holding[bestStart]
  const last = holding[bestStart + bestLength - 1]
  if (first === undefined || last === undefined) {
    throw new Error('the hiding-height run indexing broke')
  }
  return (first + last) / 2
}

// Whether the anchor's ray from every orbit pose of this height is blocked
// by a mesh before the anchor, while every other anchor's ray is clear of
// every pose.
// The orbit poses of one hiding-height candidate: the camera origin per
// distance factor and azimuth offset, and the rays they cast.
type HidingContext = {
  readonly triangles: readonly Triangle[]
  readonly homeTarget: vec3
  readonly homeDistance: number
}

function hidesAnchorButOthers(
  anchor: vec3,
  others: readonly { readonly id: string; readonly stagePosition: vec3 }[],
  azimuth: number,
  height: number,
  context: HidingContext,
): boolean {
  for (const distanceFactor of DISTANCE_FACTORS) {
    const distance = context.homeDistance * distanceFactor
    for (const offset of AZIMUTH_OFFSETS_RAD) {
      const viewAzimuth = azimuth + offset
      const rise = height - context.homeTarget[1]
      const horizontal = Math.sqrt(Math.max(0, distance * distance - rise * rise))
      const origin: vec3 = [
        context.homeTarget[0] + horizontal * Math.sin(viewAzimuth),
        height,
        context.homeTarget[2] + horizontal * Math.cos(viewAzimuth),
      ]
      if (!isBlocked(origin, anchor, context.triangles)) {
        return false
      }
      for (const other of others) {
        if (isBlocked(origin, other.stagePosition, context.triangles)) {
          return false
        }
      }
    }
  }
  return true
}

function transformPoint(m: mat4, v: vec3): vec3 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ]
}

function transformDirection(m: mat4, v: vec3): vec3 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ]
}

function subtract(a: vec3, b: vec3): vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function length(a: vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

function normalize(a: vec3): vec3 {
  const l = length(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}

// The point of the ray from the origin along the direction closest to the
// target.
function closestPointOnRay(origin: vec3, direction: vec3, target: vec3): vec3 {
  const along = dot(subtract(target, origin), direction)
  return [
    origin[0] + direction[0] * along,
    origin[1] + direction[1] * along,
    origin[2] + direction[2] * along,
  ]
}

function dot(a: vec3, b: vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
