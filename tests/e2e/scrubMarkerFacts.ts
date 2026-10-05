import { Vector3, type Object3D } from 'three'
import type { vec3 } from '@gltf-transform/core'
import type { Product } from '../../src/lib/product'
import { HOTSPOT_PREFIX } from '../../src/lib/product/contractNames.ts'
import { createExplodePose } from '../../src/features/explode/index'
import { parseShippedGltf } from './productGltf'
import type { AuthoredView } from './productCamera'
import { readOccluderMeshes } from './productMesh'
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
  const meshes = readOccluderMeshes(parsed.scene, center).meshes
  const pose = createExplodePose(parsed.scene, clip)
  const shown = new Map<string, boolean[]>(anchors.map((anchor) => [anchor.id, []]))
  for (const target of SCRUB_TARGETS) {
    pose.apply(target)
    parsed.scene.updateMatrixWorld(true)
    const visible = markersShownIn(
      {
        hotspots: anchors.map((anchor) => ({
          id: anchor.id,
          stagePosition: anchor.node.getWorldPosition(new Vector3()).toArray(),
        })),
        occluders: meshes,
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
