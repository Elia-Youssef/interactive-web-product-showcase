import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { assertStageRenderer } from '../stageIdentity'
import { createProductKtx2Loader } from './decoders'

// The KTX2 loader of the stage's renderer, in context. There is no
// module-level singleton: the loader is created inside the Canvas from the
// stage's live renderer, one per mount, and a second stage creates its own.
const ProductKtx2Context = createContext<KTX2Loader | null>(null)

// The KTX2 loader a product's loader setup needs. Only the stage's provider
// inside the Canvas can supply it; a product rendered anywhere else fails
// with a named error instead of a CDN fetch or a broken transcode.
export function useProductKtx2Loader(): KTX2Loader {
  const ktx2 = useContext(ProductKtx2Context)
  if (ktx2 === null) {
    throw new Error('A product needs the stage decoder provider: render it inside the stage Canvas')
  }
  return ktx2
}

// Renders its children once the renderer's KTX2 loader exists. The loader
// owns worker threads, so its lifetime is the effect's: every run creates a
// fresh loader, serves it through context, and disposes exactly the loader
// its own cleanup took ownership of.
export function ProductDecoderProvider({ children }: { readonly children: ReactNode }) {
  const gl = useThree((state) => state.gl)
  const [ktx2, setKtx2] = useState<KTX2Loader | null>(null)

  useEffect(() => {
    assertStageRenderer(gl)
    const loader = createProductKtx2Loader(gl)
    setKtx2(loader)
    return () => {
      setKtx2(null)
      loader.dispose()
    }
  }, [gl])

  if (ktx2 === null) {
    return null
  }
  return <ProductKtx2Context.Provider value={ktx2}>{children}</ProductKtx2Context.Provider>
}
