import { useEffect, useState } from 'react'
import { useStageHolds } from '../stageHoldsContext'
import { useProductModelLoads } from './ProductModelsProvider'
import type { ProductMeshoptDecoder } from './decoders'
import type { ProductModelEntry, StageModelLoads } from './productModelLoads'

type HeldModel = {
  readonly loads: StageModelLoads<ProductMeshoptDecoder>
  readonly url: string
  readonly entry: ProductModelEntry
}

// The product's hold on its model load, taken in the commit that mounts the
// product and dropped in the one that takes it off the stage, for as long
// as the product wants its model (a failed product does not).
//
// The load starts in the same effect that holds it, never during a render:
// a render can be thrown away before it commits (a suspended sibling, a
// navigation that replaces the product first), and a load a discarded
// render started would be held by nobody and released by nobody. Starting
// it here pairs every load with its hold, so every load the stage starts is
// released through the stage's holds, a load the product left while it was
// still running included.
//
// Answers the held entry once the effect has taken it, or null before then
// and while the product does not want its model.
export function useProductModel(url: string, wanted: boolean): ProductModelEntry | null {
  const loads = useProductModelLoads()
  const holds = useStageHolds()
  const [held, setHeld] = useState<HeldModel | null>(null)

  useEffect(() => {
    if (!wanted) {
      return
    }
    const entry = loads.readModel(url)
    holds.hold(entry)
    setHeld({ loads, url, entry })
    return () => {
      holds.drop(entry, () => loads.releaseModel(entry))
    }
  }, [loads, holds, url, wanted])

  // A hold taken for other loads or another URL is not this render's: the
  // effect for the current ones has not run yet.
  return wanted && held !== null && held.loads === loads && held.url === url ? held.entry : null
}
