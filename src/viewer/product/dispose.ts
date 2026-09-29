import { Line, Mesh, Points, Texture, type Material, type Object3D } from 'three'

// Disposes everything a loaded product scene holds: every geometry, every
// material, single or per-group array, and every texture those materials
// carry, in whatever slots they sit. A finish a variant switch applied is
// included as long as the scene holds it; materials a variants controller
// resolved but never applied do not exist in the scene and stay that
// controller's own release job. three's dispose calls are idempotent, so
// the traversal is safe to run on an already disposed scene.
export function disposeProductScene(scene: Object3D): void {
  scene.traverse((node) => {
    if (node instanceof Mesh || node instanceof Line || node instanceof Points) {
      node.geometry.dispose()
      disposeMaterial(node.material)
    }
  })
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
