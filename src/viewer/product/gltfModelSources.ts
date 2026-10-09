import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { LoaderUtils } from 'three/webgpu'
import { RetriedLoad } from '@lib/async/retriedLoad'
import {
  importProductMeshoptDecoder,
  wireMeshoptDecoder,
  wireProductDecoders,
  type ProductMeshoptDecoder,
} from './decoders'
import type { ModelRequest, ProductModelSources } from './productModelLoads'

// The response surface the byte fetch reads, kept structural: the browser's
// own Response carries it, and a test builds one from plain values.
export interface ModelResponse {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  arrayBuffer(): Promise<ArrayBuffer>
}

// The one network read of a model file: the page's own fetch, a stand-in in
// a test. Three's file loader is not used for the bytes, because it can
// carry neither a per-request priority nor a per-request cancel.
export type ModelFetch = (url: string, init: RequestInit) => Promise<ModelResponse>

// What the sources draw on that the outside world owns, each defaulting to
// the stage's own: the GLTF loader, whose parse the models go through, the
// import of the Meshopt decoder module, and the fetch the bytes are read
// with. A caller that hands in its own observes the parse, the import and
// the reads.
export interface GltfModelSourceParts {
  readonly loader?: GLTFLoader
  readonly importMeshoptDecoder?: () => Promise<ProductMeshoptDecoder>
  readonly fetch?: ModelFetch
}

// The sources of one stage's model loads, through three's own GLTFLoader:
// the one parser of the site and of the proofs that parse the shipped
// models, wired once with the stage's KTX2 loader and the finish resolver.
//
// The model's bytes come through the fetch part, the page's own fetch by
// default, with the request's priority and signal: three's file loader can
// carry neither. A non-OK answer rejects with the status and the URL, so
// the failure a load settles names its model.
//
// The parse resolves the model's resources against the model's own folder,
// as GLTFLoader.load does.
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
    fetch: fetchBytes = (url, init) => fetch(url, init),
  }: GltfModelSourceParts = {},
): ProductModelSources<ProductMeshoptDecoder> {
  wireProductDecoders(loader, ktx2)
  const decoder = new RetriedLoad(importMeshoptDecoder)
  return {
    fetchModel: (url, request) => fetchModelBytes(fetchBytes, url, request),
    decoder: () => decoder.read(),
    parse: (data, url, meshopt) => {
      wireMeshoptDecoder(loader, meshopt)
      return loader.parseAsync(data, LoaderUtils.extractUrlBase(url))
    },
  }
}

// The one network read of a model file, with the request's priority and
// signal. A non-OK answer rejects with an error naming the status and the
// URL: the underlying error a fetch failure carries names neither.
export async function fetchModelBytes(
  fetcher: ModelFetch,
  url: string,
  request: ModelRequest,
): Promise<ArrayBuffer> {
  const init: RequestInit =
    request.signal === undefined
      ? { priority: request.priority }
      : { priority: request.priority, signal: request.signal }
  const response = await fetcher(url, init)
  if (!response.ok) {
    throw new Error(`the server answered ${response.status} ${response.statusText} for ${url}`)
  }
  return response.arrayBuffer()
}
