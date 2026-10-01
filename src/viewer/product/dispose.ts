import { Line, Mesh, Points, Texture, type Material, type Object3D } from 'three'
import type { ProductFinishMaterials } from './finishMaterials'

// Disposes everything a loaded product holds: every geometry and material
// the scene carries, single or per-group array, every texture those
// materials carry in whatever slots they sit, every finish material the
// load resolved, applied or not, and every material the scene carried when
// the load was parsed, which a finish swap may have replaced on the meshes.
// The product owns all of them, so its one release lets them all go; a
// material named twice (shared between the scene and a table, or recorded
// and still applied) simply runs through the passes, and three's dispose
// calls are idempotent, so the later pass finds nothing left to free. The
// traversal is safe to run on an already disposed scene.
export function disposeProductScene(scene: Object3D, finishes: ProductFinishMaterials): void {
  scene.traverse((node) => {
    if (node instanceof Mesh || node instanceof Line || node instanceof Points) {
      node.geometry.dispose()
      disposeMaterial(node.material)
    }
  })
  for (const material of finishes.materials.values()) {
    disposeSingleMaterial(material)
  }
  for (const material of finishes.sceneMaterials) {
    disposeSingleMaterial(material)
  }
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      disposeSingleMaterial(entry)
    }
    return
  }
  disposeSingleMaterial(material)
}

function disposeSingleMaterial(material: Material): void {
  // The texture slots are walked, not named: every own property of the
  // material that is a texture, plain or in an array, goes, so a slot three
  // adds later is covered without a second list here.
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose()
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof Texture) {
          item.dispose()
        }
      }
    }
  }
  material.dispose()
}
