import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { modelUrl } from '@lib/product'
import type { Product } from '@lib/product'
import type { ModelFrame } from './modelFrame'
import type { ModelWatch } from './ModelWatch'
import { useStageModelWatch } from './stageModelContext'
import { measureModelFrame } from './modelFrame'
import { useStageCameraFit } from './useStageCameraFit'

export type ProductModelProps = {
  // The parsed product whose model loads. The slug alone reaches this
  // component: it holds no product name and builds no URL of its own.
  readonly product: Product
}

// The stage's content for one product: the model loaded by slug, centered on
// the origin and framed by the stage camera. The loader runs with no
// decoders: the stand-in model is plain glTF, with nothing compressed. Load
// failures are not handled here; the Suspense boundary that holds the
// placeholder is the stage's.
export function ProductModel({ product }: ProductModelProps) {
  const gltf = useGLTF(modelUrl(product.slug), false, false)
  const frame = useMemo(() => measureModelFrame(gltf.scene), [gltf.scene])
  const watch = useStageModelWatch()

  useStageCameraFit(frame)
  useStageModelReport(watch, product.slug, frame)

  // The offset centers the model on the origin, where the camera looks.
  return (
    <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

// Reports the model to the stage's watch once the renderer has finished its
// own async work for the scene, and clears the report on unmount. A freshly
// mounted scene is not done after its first frame: pipelines and the
// environment settle across more frames, and under demand mode nothing
// renders while they do, so a report at mount would promise a stage that
// can still change under a reader. The compile is the renderer's own signal
// for that work; its resolution pays the stage's last load-frame debt and
// marks the report, so a non-null model reads as a settled, presented one.
// The fit runs first, so the compile sees the fitted camera.
function useStageModelReport(watch: ModelWatch, slug: string, frame: ModelFrame): void {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    let cancelled = false
    const settle = () => {
      if (cancelled) {
        return
      }
      watch.report({ slug, meshes: frame.meshes, triangles: frame.triangles })
      invalidate()
    }
    void gl.compileAsync(scene, camera).then(settle, settle)
    return () => {
      cancelled = true
      watch.clear()
    }
  }, [gl, scene, camera, invalidate, watch, slug, frame])
}
