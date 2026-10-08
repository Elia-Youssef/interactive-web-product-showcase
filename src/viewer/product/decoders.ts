// The compressed asset decoding a product needs, wired into the stage's
// product model loader. Nothing here reaches a CDN: the KTX2 loader fetches
// the transcoder copies the installed three package carries, which the
// bundler emits as content-hashed assets on the loader's own URL references
// and caches under their hash. The Meshopt decoder is its own lazily
// imported chunk, off the critical chunk: a visitor who never reaches a
// product never fetches it.
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { WebGPURenderer } from 'three/webgpu'
import { registerFinishMaterialsResolver, type FinishParserLike } from './finishMaterials'

// The product's KTX2 loader, configured and not yet detected: three's own
// loader on its default transcoder path, so it fetches the transcoder copies
// its own URL references name, the one pair the bundler emits. This is the
// loader's whole configuration; a transcoder path set here would point it
// at copies the bundler never emits.
export function productKtx2Loader(): KTX2Loader {
  return new KTX2Loader()
}

// Creates the one KTX2 loader of the stage's started renderer, the
// WebGPURenderer the stage builds on both backends: the configured loader,
// then support detection. detectSupport reads the renderer's compressed
// texture features, which only exist after the awaited renderer.init() that
// the stage's factory runs; R3F mounts the scene through that factory, so
// the renderer this receives is always initialized.
export function createProductKtx2Loader(renderer: WebGPURenderer): KTX2Loader {
  return productKtx2Loader().detectSupport(renderer)
}

// The loader surface the product wiring configures, kept structural, so the
// wiring states exactly what it sets on three's GLTFLoader. register
// collects the plugin factories a parse constructs its plugin instances
// from; GLTFLoader dedupes the factories by identity.
export interface GltfLoaderLike {
  setKTX2Loader(ktx2Loader: unknown): unknown
  setMeshoptDecoder(decoder: unknown): unknown
  register(factory: (parser: FinishParserLike) => unknown): unknown
}

// Three's Meshopt decoder, as its module exports it.
export type ProductMeshoptDecoder = typeof MeshoptDecoder

// One import of three's own Meshopt decoder module, whose WebAssembly
// instantiation starts when the module arrives. It rejects when the import
// fails.
export function importProductMeshoptDecoder(): Promise<ProductMeshoptDecoder> {
  return import('three/examples/jsm/libs/meshopt_decoder.module.js').then(
    (module) => module.MeshoptDecoder,
  )
}

// Wires the loader setup every product parse shares: the renderer's KTX2
// loader and the plugin that loads every finish material with the model
// instead of on the first switch. The Meshopt decoder arrives with each
// load instead (wireMeshoptDecoder). None of it is a CDN default.
export function wireProductDecoders(loader: GltfLoaderLike, ktx2: KTX2Loader): void {
  loader.setKTX2Loader(ktx2)
  registerFinishMaterialsResolver(loader)
}

// Hands the loader the Meshopt decoder a parse needs. GLTFLoader reads its
// decoder when a parse starts, so this runs right before each parse;
// setting the same decoder again changes nothing.
export function wireMeshoptDecoder(loader: GltfLoaderLike, decoder: ProductMeshoptDecoder): void {
  loader.setMeshoptDecoder(decoder)
}
