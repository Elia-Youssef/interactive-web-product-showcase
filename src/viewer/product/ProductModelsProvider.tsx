import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { assertStageRenderer } from '../stageIdentity'
import { useStageProbes } from '../automation/stageProbesContext'
import { createProductKtx2Loader, type ProductMeshoptDecoder } from './decoders'
import { createGltfModelSources } from './gltfModelSources'
import { StageModelLoads } from './productModelLoads'

// The product model loads of the stage's renderer, in context. There is no
// module-level cache: the loads are created inside the Canvas from the
// stage's live renderer, one set per mount, and a second stage loads its
// own, so every load is held and released through the stage that renders
// it.
const ProductModelLoadsContext = createContext<StageModelLoads<ProductMeshoptDecoder> | null>(null)

// The model loads a product reads its model from. Only the stage's provider
// inside the Canvas can supply them; a product rendered anywhere else fails
// with a named error instead of a CDN fetch or a broken transcode.
export function useProductModelLoads(): StageModelLoads<ProductMeshoptDecoder> {
  const loads = useContext(ProductModelLoadsContext)
  if (loads === null) {
    throw new Error('A product needs the stage model provider: render it inside the stage Canvas')
  }
  return loads
}

// Renders its children once the renderer's decoders exist. The KTX2 loader
// owns worker threads, so its lifetime is the effect's: every run creates a
// fresh loader and the loads wired with it, serves them through context,
// reports them on the stage's loads probe, and disposes exactly the loader
// its own cleanup took ownership of.
export function ProductModelsProvider({ children }: { readonly children: ReactNode }) {
  const gl = useThree((state) => state.gl)
  const probes = useStageProbes()
  const [loads, setLoads] = useState<StageModelLoads<ProductMeshoptDecoder> | null>(null)

  useEffect(() => {
    assertStageRenderer(gl)
    const ktx2 = createProductKtx2Loader(gl)
    const created = new StageModelLoads(createGltfModelSources(ktx2))
    const releaseProbe = probes.register('loads', () => created.report())
    setLoads(created)
    return () => {
      setLoads(null)
      releaseProbe()
      ktx2.dispose()
    }
  }, [gl, probes])

  if (loads === null) {
    return null
  }
  return (
    <ProductModelLoadsContext.Provider value={loads}>{children}</ProductModelLoadsContext.Provider>
  )
}
