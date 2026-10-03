import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { KeyedLoads } from '@lib/async/keyedLoads'
import { asError } from '@lib/errors'
import { wireProductDecoders } from './decoders'

// The product models of one stage: one load per model URL, shared by every
// product mount that reads it until the hold on it is released, through
// three's own GLTFLoader, wired once with the stage's decoders and the
// finish resolver. It is the one parser of the site and of the proofs that
// parse the shipped models, and the cache is the stage's own rather than a
// module-wide one. The owner is the stage's loader provider, so the loads
// live exactly as long as the decoders they were wired with.
export type ProductModelLoads = KeyedLoads<GLTF>

export function createProductModelLoads(ktx2: KTX2Loader): ProductModelLoads {
  const loader = new GLTFLoader()
  wireProductDecoders(loader, ktx2)
  return new KeyedLoads((url) => loadProductModel(loader, url))
}

// One model load. The rejection names the model it failed for, whatever the
// loader's own error says: a network error from the browser's fetch names
// no URL, and the product's failure must.
function loadProductModel(loader: GLTFLoader, url: string): Promise<GLTF> {
  return loader.loadAsync(url).catch((cause: unknown) => {
    throw new Error(`Could not load ${url}: ${asError(cause).message}`)
  })
}
