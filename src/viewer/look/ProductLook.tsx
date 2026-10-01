import { useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, Mesh, type Material, type Object3D } from 'three'
import { resolveProductLook } from '@lib/product'
import { useStageProbes } from '../automation/stageProbesContext'
import { useLoadedProduct } from '../product/loadedProduct'
import { assertStageRenderer, assertStageScene } from '../stageIdentity'
import { lookDefaults } from './config'
import { createLookReader } from './lookReader'

// The material the SHADOW mesh carries, narrowed from the rig's node: a
// single material on a mesh, or the model breaks the shadow contract. The
// loader builds it unlit (KHR_materials_unlit) with alphaMode BLEND, which
// is what the flags below are enforced on.
function shadowMaterialOf(shadowNode: Object3D): Material {
  if (!(shadowNode instanceof Mesh)) {
    throw new Error('the SHADOW node carries no mesh, so there is no shadow material to look')
  }
  const { material } = shadowNode
  if (Array.isArray(material)) {
    throw new Error('the SHADOW mesh carries a material array, expected one material')
  }
  return material
}

// The product's look, applied to the stage before the product reports ready.
// It resolves the manifest's look block against the look defaults, writes the
// values in a layout effect, and registers the stage's look probe for the
// automation hook. Every value lands before the presentation's mount settle
// runs, so ready means the look is on a recorded frame.
export function ProductLook() {
  const loaded = useLoadedProduct()
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const probes = useStageProbes()

  const look = useMemo(
    () => resolveProductLook(loaded.manifest.look, lookDefaults),
    [loaded.manifest.look],
  )

  useLayoutEffect(() => {
    // A renderer or scene from a second copy of three fails here, into the
    // product boundary, like every start-up check of the stage.
    assertStageRenderer(gl)
    assertStageScene(scene)

    const shadowMaterial = shadowMaterialOf(loaded.rig.shadow)
    probes.register('look', createLookReader(gl, scene, shadowMaterial, loaded.scene))

    // Exposure scales the whole frame's tone mapping; the environment
    // intensity and rotation feed the image based lighting of the lit
    // materials. All three are uniforms in the node system, so the frame the
    // mount settle records carries them without any pipeline rebuild.
    gl.toneMappingExposure = look.exposure
    scene.environmentIntensity = look.environmentIntensity
    scene.environmentRotation.set(0, MathUtils.degToRad(look.environmentRotationDeg), 0)

    // The shadow plane is an alpha overlay over the CSS backdrop: it must
    // blend (the glTF's alphaMode BLEND) and never write depth over what it
    // covers. The loader already sets both flags for alphaMode BLEND
    // (GLTFLoader's material path), so these writes hold the contract rather
    // than change it. There is no per-material tone-mapping opt-out to write:
    // the node renderer tone maps once in its full-frame output pass, and
    // the baked shadow's RGB is black, a fixed point of any tone curve and
    // of exposure, so the shadow's pixels cannot move with either. A flag
    // change rebuilds the material's render pipelines, which is why this runs
    // in a layout effect: React flushes every layout effect of a commit
    // before any passive effect of that commit, and the presentation's mount
    // settle starts in a passive effect, so the flags stand on the material
    // before the settle compiles it.
    shadowMaterial.transparent = true
    shadowMaterial.depthWrite = false
    // The opacity the loader authored, read before the scale: the cleanup
    // restores it, so every effect run starts from the authored value, under
    // StrictMode and on a look change alike.
    const authored = shadowMaterial.opacity
    shadowMaterial.opacity = authored * look.shadowOpacity

    return () => {
      // The renderer and scene values are the stage's shared state, so they
      // go back to the config defaults when the product leaves, and the
      // shadow material's opacity back to what the loader authored: a
      // restore of values, not a release of resources. The shadow material
      // belongs to the product's scene and goes with it; nothing here
      // disposes.
      probes.unregister('look')
      gl.toneMappingExposure = lookDefaults.exposure
      scene.environmentIntensity = lookDefaults.environmentIntensity
      scene.environmentRotation.set(0, MathUtils.degToRad(lookDefaults.environmentRotationDeg), 0)
      shadowMaterial.opacity = authored
    }
  }, [gl, scene, probes, loaded.rig.shadow, loaded.scene, look])

  return null
}
