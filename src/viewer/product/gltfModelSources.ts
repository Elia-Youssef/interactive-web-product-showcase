import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { FileLoader, LoaderUtils } from 'three/webgpu'
import { RetriedLoad } from '@lib/async/retriedLoad'
import {
  importProductMeshoptDecoder,
  wireMeshoptDecoder,
  wireProductDecoders,
  type ProductMeshoptDecoder,
} from './decoders'
import type { ProductModelSources } from './productModelLoads'

// What the sources draw on that the outside world owns, each defaulting to
// the stage's own: the GLTF loader, whose manager carries the model's
// requests, and the import of the Meshopt decoder module. A caller that hands
// in its own observes the manager, the import and the parse.
export interface GltfModelSourceParts {
  readonly loader?: GLTFLoader
  readonly importMeshoptDecoder?: () => Promise<ProductMeshoptDecoder>
}

// The sources of one stage's model loads, through three's own GLTFLoader:
// the one parser of the site and of the proofs that parse the shipped
// models, wired once with the stage's KTX2 loader and the finish resolver.
//
// The model's bytes come through three's file loader on the GLTF loader's
// own manager, the request GLTFLoader.load makes itself, so a failed fetch
// reports the same error. The parse resolves the model's resources against
// the model's own folder, as GLTFLoader.load does.
//
// The Meshopt decoder import is shared by the stage's loads until it fails.
// A failed import fails the loads that met it, each as its own typed load
// failure, and the next load starts the import again: a transient network
// failure never leaves the stage unable to load any later product. Whether
// a retried import reaches the network again is the browser's module
// loader's call; either way the load settles as a typed failure.
export function createGltfModelSources(
  ktx2: KTX2Loader,
  {
    loader = new GLTFLoader(),
    importMeshoptDecoder = importProductMeshoptDecoder,
  }: GltfModelSourceParts = {},
): ProductModelSources<ProductMeshoptDecoder> {
  wireProductDecoders(loader, ktx2)
  const bytes = new FileLoader<ArrayBuffer>(loader.manager).setResponseType('arraybuffer')
  const decoder = new RetriedLoad(importMeshoptDecoder)
  return {
    fetchModel: (url) => bytes.loadAsync(url),
    decoder: () => decoder.read(),
    parse: (data, url, meshopt) => {
      wireMeshoptDecoder(loader, meshopt)
      return loader.parseAsync(data, LoaderUtils.extractUrlBase(url))
    },
  }
}
