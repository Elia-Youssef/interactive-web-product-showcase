import { AnimationClip, Object3D, PerspectiveCamera } from 'three/webgpu'
import type { ProductSource } from './parseProductRig'

// Tree fixtures for the rig tests. Three's core runs without a DOM, so the
// fixtures are plain Object3D trees in the shape the Blender contract and
// the optimize step produce, unnamed wrapper nodes included.

export function named(name: string): Object3D {
  const node = new Object3D()
  node.name = name
  return node
}

export function cameraNode(name: string): PerspectiveCamera {
  const camera = new PerspectiveCamera()
  camera.name = name
  return camera
}

export function attach(parent: Object3D, ...children: readonly Object3D[]): Object3D {
  for (const child of children) {
    parent.add(child)
  }
  return parent
}

// The valid tree of the sample manifest: two hotspots parented to their
// parts, two cameras, the shadow plane.
export function validTree(): Object3D {
  return new Object3D().add(
    cameraNode('CAM_home'),
    cameraNode('CAM_driver'),
    attach(named('PART_base'), new Object3D()),
    attach(named('PART_body'), named('HS_shell'), new Object3D()),
    attach(named('PART_grille'), named('HS_driver'), new Object3D()),
    named('SHADOW'),
  )
}

export function explodeClip(durationSeconds: number): AnimationClip {
  return new AnimationClip('Explode', durationSeconds, [])
}

// The glTF JSON the loader would hold for a tree: the node table (the
// authority on which names are contract nodes) plus the variants extension.
// The node names are the tree's unique names, so a duplicated row still
// declares the name once, as a broken file would after the loader's own
// uniquification.
function gltfJson(tree: Object3D, variants: readonly string[]): unknown {
  const names = new Set<string>()
  tree.traverse((node) => {
    if (node.name !== '') {
      names.add(node.name)
    }
  })
  return {
    nodes: [...names].map((name) => ({ name })),
    extensions: {
      KHR_materials_variants: { variants: variants.map((name) => ({ index: 0, name })) },
    },
  }
}

export function variantsJson(names: readonly string[]): unknown {
  return {
    extensions: {
      KHR_materials_variants: { variants: names.map((name) => ({ index: 0, name })) },
    },
  }
}

export function sourceOf(
  tree: Object3D,
  animations: readonly AnimationClip[] = [explodeClip(0.5)],
  json: unknown = gltfJson(tree, ['sage', 'graphite']),
): ProductSource {
  return { scene: tree, animations, json }
}
