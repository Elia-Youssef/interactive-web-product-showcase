import {
  Line,
  Mesh,
  Points,
  Texture,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three/webgpu'
import type { ProductFinishMaterials } from './finishMaterials'

// Disposes everything a loaded product holds: every geometry the scene
// carries, and every material the four sources name, the scene, the derived
// table, the raw record and the parse-time record, single or per-group
// array, with every texture those materials carry in whatever slots they
// sit. The product owns all of them, so its one release lets them all go;
// the four sources name one set first, so a material named by several of
// them, the way a mesh's default derived material sits on the scene and in
// two tables at once, is disposed exactly once. The traversal is safe to
// run on an already disposed scene.
export function disposeProductScene(
  scene: Object3D,
  finishes: ProductFinishMaterials | null,
): void {
  const materials = new Set<Material>()
  const geometries = new Set<BufferGeometry>()
  const textures = new Set<Texture>()
  scene.traverse((node) => {
    if (node instanceof Mesh || node instanceof Line || node instanceof Points) {
      geometries.add(node.geometry)
      collectMaterial(materials, node.material)
    }
  })
  if (finishes !== null) {
    collectFinishMaterials(materials, finishes)
  }
  for (const geometry of geometries) {
    geometry.dispose()
  }
  for (const material of materials) {
    collectTextures(textures, material)
  }
  for (const texture of textures) {
    texture.dispose()
  }
  for (const material of materials) {
    material.dispose()
  }
}

function collectFinishMaterials(materials: Set<Material>, finishes: ProductFinishMaterials): void {
  for (const material of finishes.materials.values()) {
    materials.add(material)
  }
  for (const material of finishes.rawMaterials.values()) {
    materials.add(material)
  }
  for (const material of finishes.sceneMaterials) {
    materials.add(material)
  }
}

function collectMaterial(materials: Set<Material>, material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      materials.add(entry)
    }
    return
  }
  materials.add(material)
}

function collectTextures(textures: Set<Texture>, material: Material): void {
  // The texture slots are walked, not named: every own property of the
  // material that is a texture, plain or in an array, goes, so a slot three
  // adds later is covered without a second list here.
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      textures.add(value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof Texture) {
          textures.add(item)
        }
      }
    }
  }
}
