import type { AnimationClip, Object3D } from 'three/webgpu'
import { KeyedLoads } from '@lib/async/keyedLoads'
import { asError } from '@lib/errors'
import type { ProductFailure } from '@lib/product'
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

// What one model load draws on: the model's bytes, the decoder its
// compressed buffers need, and the parse of the bytes with that decoder.
// Kept structural and generic over the decoder, so the load's ordering and
// failure mapping are testable with plain promises.
export interface ProductModelSources<Decoder> {
  // Starts fetching the model's bytes.
  fetchModel(url: string): Promise<ArrayBuffer>
  // The decoder a parse needs, read once per load.
  decoder(): Promise<Decoder>
  // Parses the fetched bytes with the decoder.
  parse(bytes: ArrayBuffer, url: string, decoder: Decoder): Promise<LoadedModel>
}

// The product models of one stage: one load per model URL, shared by every
// product mount that reads it until the hold on it is released. The cache
// is the stage's own rather than a module-wide one, and a load settles as a
// value, which a loader read through a suspense cache that rethrows in
// render cannot do. The owner is the stage's model provider, so the loads
// live exactly as long as the decoders their sources were wired with.
export type ProductModelLoads = KeyedLoads<ProductModelLoad>

export function createProductModelLoads<Decoder>(
  sources: ProductModelSources<Decoder>,
): ProductModelLoads {
  return new KeyedLoads((url) => loadProductModel(sources, url))
}

// One model load, settled as its outcome. The model's bytes and its decoder
// start together, in the call itself, and the parse waits for both, so a
// load takes the slower of the two, never their sum. Every failure, the
// fetch, the decoder or the parse, and a source that throws before
// returning its promise, settles as the load failure naming the model,
// whatever the underlying error says: a network error from the browser's
// fetch names no URL, and the product's failure must.
export function loadProductModel<Decoder>(
  sources: ProductModelSources<Decoder>,
  url: string,
): Promise<ProductModelLoad> {
  const inputs = new Promise<readonly [ArrayBuffer, Decoder]>((resolve) => {
    resolve(Promise.all([sources.fetchModel(url), sources.decoder()]))
  })
  return inputs
    .then(([bytes, decoder]) => sources.parse(bytes, url, decoder))
    .then(
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
