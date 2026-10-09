import { useEffect } from 'react'
import { productModelUrl } from '@lib/product'
import { useStageHolds } from '../stageHoldsContext'
import { useProductModelLoads } from './ProductModelsProvider'

type ProductPreloadProps = {
  // The products whose model files the stage reads ahead. The caller owns
  // the list's identity: a new list is a new set of reads ahead.
  readonly slugs: readonly string[]
}

// Reads the named products' model files ahead, through the stage's loads
// and holds: each file is read once, at low priority, as bytes only, and
// held for exactly as long as it stays on the list. A file that leaves the
// list is released and its read cancelled; a file a product on the stage
// took over is that product's load. Nothing here parses, decodes or uploads,
// so a product read ahead costs its file's bytes and nothing on the GPU.
export function ProductPreload({ slugs }: ProductPreloadProps) {
  const loads = useProductModelLoads()
  const holds = useStageHolds()

  useEffect(() => {
    const entries = slugs.map((slug) => loads.readAhead(productModelUrl(slug)))
    for (const entry of entries) {
      holds.hold(entry)
    }
    return () => {
      for (const entry of entries) {
        holds.drop(entry, () => loads.releaseAhead(entry))
      }
    }
  }, [loads, holds, slugs])

  return null
}
