import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { assertStageRenderer } from '../stageIdentity'
import { useStageHolds } from '../stageHoldsContext'
import { useLoadLedger } from '../loadLedgerContext'
import { createProductKtx2Loader, type ProductMeshoptDecoder } from './decoders'
import { createGltfModelSources } from './gltfModelSources'
import { StageModelLoads } from './productModelLoads'
import { useStageModelOwners } from './StageModelOwnersProvider'

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

// Renders its children once the renderer's decoders exist. Each committed
// run creates and holds one loading owner. Cleanup ends admission, and its
// leases keep KTX2's workers alive until parsing and result disposal drain.
// The stage observes obsolete owners until that release completes.
export function ProductModelsProvider({ children }: { readonly children: ReactNode }) {
  const gl = useThree((state) => state.gl)
  const owners = useStageModelOwners()
  const holds = useStageHolds()
  const ledger = useLoadLedger()
  const [loads, setLoads] = useState<StageModelLoads<ProductMeshoptDecoder> | null>(null)

  useEffect(() => {
    assertStageRenderer(gl)
    const ktx2 = createProductKtx2Loader(gl)
    const created = new StageModelLoads(
      createGltfModelSources(ktx2),
      (url, wanted) => ledger.transfer(url, wanted),
      () => {
        try {
          ktx2.dispose()
        } finally {
          releaseOwner()
        }
      },
    )
    const releaseOwner = owners.register(created)
    holds.hold(created)
    setLoads(created)
    return () => {
      setLoads(null)
      holds.drop(created, () => created.retire())
    }
  }, [gl, owners, holds, ledger])

  if (loads === null) {
    return null
  }
  return (
    <ProductModelLoadsContext.Provider value={loads}>{children}</ProductModelLoadsContext.Provider>
  )
}
