import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { LoaderUtils } from 'three/webgpu'
import { readWithProgress } from '@lib/async/readWithProgress'
import { RetriedLoad } from '@lib/async/retriedLoad'
import {
  importProductMeshoptDecoder,
  wireMeshoptDecoder,
  wireProductDecoders,
  type ProductMeshoptDecoder,
} from './decoders'
import type { ModelRequest, ProductModelSources } from './productModelLoads'

// The response surface the byte fetch reads, kept structural: the browser's
// own Response carries it, and a test builds one from plain values. The
// header read and the body stream are the two the progress reports need: the
// size the transfer claims and the bytes as they arrive.
export interface ModelResponse {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  readonly headers: { get(name: string): string | null }
  readonly body: ReadableStream<Uint8Array> | null
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
// signal. The bytes stream through the progress report the request carries,
// so the transfer they belong to learns what was read; a body without a
// stream falls back to the response's own buffer read, with the transfer
// never learning a total. Every end of the read, the bytes in, a non-OK
// answer, a fetch that itself rejects, ends the transfer. A non-OK answer
// rejects with an error naming the status and the URL: the underlying error
// a fetch failure carries names neither.
export async function fetchModelBytes(
  fetcher: ModelFetch,
  url: string,
  request: ModelRequest,
): Promise<ArrayBuffer> {
  const init: RequestInit =
    request.signal === undefined
      ? { priority: request.priority }
      : { priority: request.priority, signal: request.signal }
  const progress = request.progress
  try {
    const response = await fetcher(url, init)
    if (!response.ok) {
      throw new Error(`the server answered ${response.status} ${response.statusText} for ${url}`)
    }
    if (response.body === null) {
      return await response.arrayBuffer()
    }
    return await readWithProgress(
      response.body,
      contentLengthTotal(response.headers),
      progress.bytes,
      request.signal,
    )
  } finally {
    progress.ended()
  }
}

// The whole size the response names, or null while it names none that can
// be divided: a missing or unusable Content-Length, a size of zero, and a
// Content-Encoding, whose length names the compressed bytes while the
// stream counts the decoded ones.
function contentLengthTotal(headers: { get(name: string): string | null }): number | null {
  if (headers.get('content-encoding') !== null) {
    return null
  }
  const raw = headers.get('content-length')
  if (raw === null) {
    return null
  }
  const total = Number(raw)
  return Number.isSafeInteger(total) && total > 0 ? total : null
}
