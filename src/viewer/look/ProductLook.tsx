import { useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, Mesh, type Material, type Object3D } from 'three'
import { resolveProductLook } from '@lib/product'
import { useStageProbes } from '../automation/stageProbesContext'
import { useLoadedProduct } from '../product/loadedProduct'
import { assertStageRenderer, assertStageScene } from '../stageIdentity'
import { lookDefaults } from './config'
import { createLookReader } from './lookReader'
import { createShadowOpacityOwner } from './shadowOpacityOwner'
import { useShadowOpacityHolder } from './shadowOpacityContext'

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
  const holder = useShadowOpacityHolder()

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
    const releaseProbe = probes.register(
      'look',
      createLookReader(gl, scene, shadowMaterial, loaded.scene),
    )

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
    // change rebuilds the material's render pipelines, which is why this
    // runs in a layout effect: React flushes every layout effect of a
    // commit before any passive effect of that commit, and the
    // presentation's mount settle starts in a passive effect, so the flags
    // stand on the material before the settle presents it.
    shadowMaterial.transparent = true
    shadowMaterial.depthWrite = false

    // The opacity is the one owner's composition, never a direct write: the
    // owner reads the authored value once, this look sets its factor, and
    // the exploded view's fade claims its own factor beside it, so the two
    // writers cannot fight. The cleanup restores the authored value for when
    // the product leaves. The opacity itself is a uniform in the node
    // system, refreshed per rendered frame from the material property, so
    // neither this write nor a fade frame needs a pipeline rebuild or a
    // settle.
    const owner = createShadowOpacityOwner(shadowMaterial)
    const releaseOwner = holder.install(owner)
    owner.setLookFactor(look.shadowOpacity)

    return () => {
      // The renderer and scene values are the stage's shared state, so they
      // go back to the config defaults when the product leaves, and the
      // shadow material's opacity back to what the loader authored: a
      // restore of values, not a release of resources. The shadow material
      // belongs to the product's scene and goes with it; nothing here
      // disposes. The probe release is this registration's own, so a stale
      // cleanup cannot drop a reader a later effect run installed.
      releaseProbe()
      releaseOwner()
      owner.restore()
      gl.toneMappingExposure = lookDefaults.exposure
      scene.environmentIntensity = lookDefaults.environmentIntensity
      scene.environmentRotation.set(0, MathUtils.degToRad(lookDefaults.environmentRotationDeg), 0)
    }
  }, [gl, scene, probes, holder, loaded.rig.shadow, loaded.scene, look])

  return null
}
