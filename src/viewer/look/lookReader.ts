import {
  Line,
  MathUtils,
  Mesh,
  Points,
  Texture,
  type Material,
  type Object3D,
  type Scene,
} from 'three/webgpu'
import type { ViewerLook, ViewerLookTexture } from '../automation/viewerAutomation'

// The reader of one product's applied look, registered as the stage's look
// probe while the product is mounted. It holds references, never values:
// exposure, intensity, rotation and the material flags are read off the
// renderer, the scene and the material at access time, so the automation
// hook cannot report a copy that drifted from the real thing. The
// constructor takes the stage's renderer and scene, which outlive the
// product, and the product's shadow material and scene, which go with it.

// The one renderer capability the reader needs, stated structurally: the
// stage renderer hands it over, and a test can stand in for it.
export type LookRenderer = {
  readonly toneMappingExposure: number
}

export function createLookReader(
  gl: LookRenderer,
  scene: Scene,
  shadowMaterial: Material | null,
  productScene: Object3D | null,
): () => ViewerLook {
  return () => ({
    exposure: gl.toneMappingExposure,
    environmentIntensity: scene.environmentIntensity,
    environmentRotationDeg: MathUtils.radToDeg(scene.environmentRotation.y),
    shadow:
      shadowMaterial === null
        ? null
        : {
            opacity: shadowMaterial.opacity,
            transparent: shadowMaterial.transparent,
            depthWrite: shadowMaterial.depthWrite,
          },
    textures: productScene === null ? null : collectTextureColorSpaces(productScene),
  })
}

// Every texture the scene's materials carry, with the material, the slot and
// the color space the loader left on it. The slots are walked, not named, so
// a slot three adds later is covered without a second list here.
function collectTextureColorSpaces(productScene: Object3D): ViewerLookTexture[] {
  const textures: ViewerLookTexture[] = []
  productScene.traverse((node) => {
    if (!(node instanceof Mesh || node instanceof Line || node instanceof Points)) {
      return
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      for (const [slot, value] of Object.entries(material)) {
        if (value instanceof Texture) {
          textures.push({ material: material.name, slot, colorSpace: value.colorSpace })
        }
      }
    }
  })
  return textures
}
