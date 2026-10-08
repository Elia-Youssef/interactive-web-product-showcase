import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { AnimationClip, Object3D } from 'three/webgpu'
import { KeyedLoads } from '@lib/async/keyedLoads'
import { asError } from '@lib/errors'
import type { ProductFailure } from '@lib/product'
import { wireProductDecoders } from './decoders'
import { disposeProductScene } from './dispose'
import { readFinishResolution } from './finishMaterials'
import type { ProductGltfParser } from './loadedProduct'

// A loaded product model as the product path reads it, kept structural:
// three's GLTF result carries this shape, and a test builds it from plain
// trees.
export interface LoadedModel {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
  readonly parser: ProductGltfParser
  readonly userData: object
}

// The outcome of one model load. A model that cannot load is an outcome the
// product path anticipates, so the load resolves to it as a value and never
// rejects: a reader that suspends on the load never has a rejection thrown
// into its render.
export type ProductModelLoad =
  | { readonly kind: 'loaded'; readonly model: LoadedModel }
  | { readonly kind: 'failed'; readonly failure: Extract<ProductFailure, { kind: 'load' }> }

// The product models of one stage: one load per model URL, shared by every
// product mount that reads it until the hold on it is released, through
// three's own GLTFLoader, wired once with the stage's decoders and the
// finish resolver. It is the one parser of the site and of the proofs that
// parse the shipped models, the cache is the stage's own rather than a
// module-wide one, and a load settles as a value, which a loader read
// through a suspense cache that rethrows in render cannot do. The owner is
// the stage's model provider, so the loads live exactly as long as the
// decoders they were wired with.
export type ProductModelLoads = KeyedLoads<ProductModelLoad>

export function createProductModelLoads(ktx2: KTX2Loader): ProductModelLoads {
  const loader = new GLTFLoader()
  wireProductDecoders(loader, ktx2)
  return new KeyedLoads((url) => loadProductModel(loader, url))
}

// One model load, settled as its outcome. The failure names the model it
// failed for, whatever the loader's own error says: a network error from
// the browser's fetch names no URL, and the product's failure must.
export function loadProductModel(
  loader: { loadAsync(url: string): Promise<LoadedModel> },
  url: string,
): Promise<ProductModelLoad> {
  return loader.loadAsync(url).then(
    (model): ProductModelLoad => ({ kind: 'loaded', model }),
    (cause: unknown): ProductModelLoad => ({
      kind: 'failed',
      failure: { kind: 'load', url, message: asError(cause).message },
    }),
  )
}

// Releases what one load created: the loaded scene, with every finish
// material the load resolved; a load whose finish mappings broke resolved
// none beyond the scene's own. A failed load created nothing to release.
export function releaseProductModel(load: ProductModelLoad): void {
  if (load.kind === 'loaded') {
    const finish = readFinishResolution(load.model.userData)
    disposeProductScene(load.model.scene, finish.kind === 'resolved' ? finish.finishes : null)
  }
}
