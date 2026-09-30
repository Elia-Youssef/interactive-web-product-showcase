import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { modelUrl } from '@lib/product'
import type { Product } from '@lib/product'
import type { ModelFrame } from './modelFrame'
import type { ModelWatch } from './ModelWatch'
import { useStageModelWatch } from './stageModelContext'
import { measureModelFrame } from './modelFrame'
import { useStageCameraFit } from './useStageCameraFit'
import { useStageSettle } from './stageSettleContext'

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
  const compileFailure = useStageModelReport(watch, product.slug, frame)
  // A failed compile is thrown to the boundary that owns the stage's content
  // failures, never reported as a settled model.
  if (compileFailure !== null) {
    throw compileFailure
  }

  // The offset centers the model on the origin, where the camera looks.
  return (
    <group position={[-frame.centerX, -frame.centerY, -frame.centerZ]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

// Reports the model to the stage's watch once the stage has settled around
// it: the stage's settle compiles the scene the model just joined, presents
// it, and holds the settled promise until that frame is recorded, so a
// non-null model reads as a model the stage has presented, not one whose
// render pipelines may still be pending. The settle is the stage's own chain,
// so an environment assignment that lands during the compile is included
// before the report moves. A rejected compile is returned as the failure, and
// the model is never reported.
function useStageModelReport(watch: ModelWatch, slug: string, frame: ModelFrame): Error | null {
  const settleScene = useStageSettle()
  const [failure, setFailure] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    const settle = () => {
      if (cancelled) {
        return
      }
      watch.report({ slug, meshes: frame.meshes, triangles: frame.triangles })
    }
    const fail = (error: unknown) => {
      if (cancelled) {
        return
      }
      setFailure(error instanceof Error ? error : new Error(String(error)))
    }
    settleScene().then(settle, fail)
    return () => {
      cancelled = true
      watch.clear()
    }
  }, [settleScene, watch, slug, frame])

  return failure
}
