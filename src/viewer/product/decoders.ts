// The compressed asset decoding a product needs, wired through the loader
// Drei's useGLTF hands us. Nothing here reaches a CDN: the KTX2 transcoder
// is served from the transcoder path (src/lib/product/transcoderPath.ts,
// the one module that defines it; scripts/copyBasis.ts keeps the copies
// fresh) and the Meshopt decoder is bundled from three's own module.
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { basisTranscoderPath } from '@lib/product'
import type { WebGLRenderer } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { registerFinishMaterialsResolver, type FinishParserLike } from './finishMaterials'

// The transcoder path the wiring points the loader at, carried from its one
// module so this surface states what it configures.
export { basisTranscoderPath }

// Creates the one KTX2 loader of a started renderer: local transcoder path,
// then support detection. detectSupport reads the renderer's compressed
// texture features, which only exist after the awaited renderer.init() that
// the stage's factory runs; R3F mounts the scene through that factory, so
// the renderer this receives is always initialized.
export function createProductKtx2Loader(renderer: WebGLRenderer | WebGPURenderer): KTX2Loader {
  return new KTX2Loader().setTranscoderPath(basisTranscoderPath).detectSupport(renderer)
}

// The loader surface the product wiring configures, kept structural: Drei
// hands the extendLoader callback its own GLTFLoader, whose setters match
// these signatures at runtime while carrying its own loader types. register
// collects the plugin factories a parse constructs its plugin instances
// from; GLTFLoader dedupes the factories by identity.
export interface GltfLoaderLike {
  setKTX2Loader(ktx2Loader: unknown): unknown
  setMeshoptDecoder(decoder: unknown): unknown
  register(factory: (parser: FinishParserLike) => unknown): unknown
}

// Wires the loader setup a product load needs: the renderer's KTX2 loader,
// three's bundled Meshopt decoder, and the plugin that loads every finish
// material with the model instead of on the first switch. Drei's own draco
// and meshopt paths stay off (useGLTF's false, false), so these calls are
// the whole setup and none of it is a CDN default.
export function wireProductDecoders(loader: GltfLoaderLike, ktx2: KTX2Loader): void {
  loader.setKTX2Loader(ktx2)
  loader.setMeshoptDecoder(MeshoptDecoder)
  registerFinishMaterialsResolver(loader)
}
