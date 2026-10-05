import { Mesh, Vector3, type Object3D } from 'three'
import type { vec3 } from '@gltf-transform/core'
import type { Product } from '../../src/lib/product'
import { HOTSPOT_PREFIX, SHADOW_NODE_NAME } from '../../src/lib/product/contractNames.ts'
import { createExplodePose } from '../../src/features/explode/explodePose'
import { parseShippedGltf } from './productGltf'
import type { AuthoredView } from './productCamera'
import type { Triangle } from './productMesh'
import { markersShownIn, type MarkerStage } from './productMarkerViews'

// Which markers the home view shows while the explode scrubs, computed in
// Node from the shipped model: the model parsed by three's own loader,
// posed at each scrub target by the explode feature's own pose (the clip
// the app plays), and the visibility rule the marker views restate, over
// the posed meshes and anchors. The specs choose the subjects of the card
// proof from these facts, so a subject is a hotspot whose marker the
// scrub really hides and shows, never one picked by position in a list.

// The targets a scrub steps through from the assembled pose to fully
// exploded, in order: the same steps the card proof drives the slider
// through.
export const SCRUB_TARGETS: readonly number[] = Array.from(
  { length: 20 },
  (_, index) => (index + 1) / 20,
)

// For each manifest hotspot, whether the home view shows its marker at
// each scrub target, in target order.
export type ScrubMarkerFacts = ReadonlyMap<string, readonly boolean[]>

export async function readScrubMarkerFacts(
  product: Product,
  center: vec3,
  home: AuthoredView,
  stage: MarkerStage,
): Promise<ScrubMarkerFacts> {
  const parsed = await parseShippedGltf(product.slug)
  const clip = parsed.animations.find((animation) => animation.name === product.explode.clip)
  if (clip === undefined) {
    throw new Error(`the ${product.slug} model carries no ${product.explode.clip} clip`)
  }
  const anchors = product.hotspots.map((hotspot) => ({
    id: hotspot.id,
    node: nodeNamed(parsed.scene, `${HOTSPOT_PREFIX}${hotspot.id}`, product.slug),
  }))
  const meshes = occluderMeshesOf(parsed.scene)
  const pose = createExplodePose(parsed.scene, clip)
  const shown = new Map<string, boolean[]>(anchors.map((anchor) => [anchor.id, []]))
  for (const target of SCRUB_TARGETS) {
    pose.apply(target)
    parsed.scene.updateMatrixWorld(true)
    const visible = markersShownIn(
      {
        hotspots: anchors.map((anchor) => ({
          id: anchor.id,
          stagePosition: inStage(anchor.node.getWorldPosition(new Vector3()), center),
        })),
        occluders: meshes.flatMap((mesh) => trianglesOf(mesh, center)),
      },
      home,
      stage,
    )
    for (const anchor of anchors) {
      shown.get(anchor.id)?.push(visible.has(anchor.id))
    }
  }
  pose.dispose()
  return shown
}

function nodeNamed(scene: Object3D, name: string, slug: string): Object3D {
  const node = scene.getObjectByName(name)
  if (node === undefined) {
    throw new Error(`the ${slug} model holds no ${name} node`)
  }
  return node
}

// Every mesh of the scene except the shadow subtree: the set the runtime's
// occluder collection walks.
function occluderMeshesOf(scene: Object3D): readonly Mesh[] {
  const meshes: Mesh[] = []
  scene.traverse((node) => {
    if (node instanceof Mesh && !isUnderShadow(node)) {
      meshes.push(node)
    }
  })
  return meshes
}

function isUnderShadow(node: Object3D): boolean {
  for (let current: Object3D | null = node; current !== null; current = current.parent) {
    if (current.name === SHADOW_NODE_NAME) {
      return true
    }
  }
  return false
}

// The mesh's triangles in stage space at its current world matrix.
function trianglesOf(mesh: Mesh, center: vec3): readonly Triangle[] {
  const position = mesh.geometry.getAttribute('position')
  if (position === undefined) {
    throw new Error(`the mesh '${mesh.name}' carries no positions`)
  }
  const index = mesh.geometry.index
  const count = index === null ? position.count : index.count
  const vertex = (at: number): vec3 => {
    const local = new Vector3().fromBufferAttribute(position, index === null ? at : index.getX(at))
    return inStage(local.applyMatrix4(mesh.matrixWorld), center)
  }
  const triangles: Triangle[] = []
  for (let face = 0; face + 2 < count; face += 3) {
    triangles.push([vertex(face), vertex(face + 1), vertex(face + 2)])
  }
  return triangles
}

function inStage(point: Vector3, center: vec3): vec3 {
  return [point.x - center[0], point.y - center[1], point.z - center[2]]
}
