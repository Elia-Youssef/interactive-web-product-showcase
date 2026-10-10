import type { AnimationClip, Object3D } from 'three/webgpu'
import { KeyedLoads, type KeyedLoad } from '@lib/async/keyedLoads'
import { startPromise } from '@lib/async/startPromise'
import { asError } from '@lib/errors'
import type { ProductFailure } from '@lib/product'
import type { ViewerLoads } from '../automation/viewerAutomation'
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

// The load failure of a model, named once: the product failure that says
// the model itself could not be fetched or read, carrying its URL.
export type ModelLoadFailure = Extract<ProductFailure, { kind: 'load' }>

// The outcome of one model load. A model that cannot load is an outcome the
// product path anticipates, so the load resolves to it as a value and never
// rejects: a reader that suspends on the load never has a rejection thrown
// into its render.
export type ProductModelLoad =
  | { readonly kind: 'loaded'; readonly model: LoadedModel }
  | { readonly kind: 'failed'; readonly failure: ModelLoadFailure }

export type ProductModelEntry = KeyedLoad<ProductModelLoad>

// The request a model's byte fetch carries: its priority against the
// page's other fetches, high for the product the visitor waits for and low
// for the files read ahead, and, for a read ahead, the signal its owner
// cancels it with once nothing wants it any more.
export type ModelRequest = {
  readonly priority: 'high' | 'low'
  readonly signal?: AbortSignal
}

// What one model load draws on: the model's bytes, the decoder its
// compressed buffers need, and the parse of the bytes with that decoder.
// Kept structural and generic over the decoder, so the load's ordering and
// failure mapping are testable with plain promises.
export interface ProductModelSources<Decoder> {
  // Starts fetching the model's bytes, with the request's priority and
  // signal. Rejects on a failed read: the load settles the rejection as
  // its own typed failure.
  fetchModel(url: string, request: ModelRequest): Promise<ArrayBuffer>
  // The decoder a parse needs, read once per load.
  decoder(): Promise<Decoder>
  // Parses the fetched bytes with the decoder.
  parse(bytes: ArrayBuffer, url: string, decoder: Decoder): Promise<LoadedModel>
}

// The product models of one stage: one load per model URL, shared by every
// product mount that reads it until the hold on it is released. The owner
// is the stage's model provider, so the loads live exactly as long as the
// decoders their sources were wired with.
export class StageModelLoads<Decoder> {
  readonly #models: KeyedLoads<ProductModelLoad>
  readonly #bytes: KeyedLoads<ArrayBuffer>
  // The cancel of every live read ahead, by model URL. An entry leaves when
  // its read ahead is released or taken over by a model load.
  readonly #cancels = new Map<string, AbortController>()
  readonly #sources: ProductModelSources<Decoder>
  #settling = 0
  #leases = 0
  #retired = false
  #disposed = false

  constructor(
    sources: ProductModelSources<Decoder>,
    private readonly disposeDecoders = () => {},
  ) {
    this.#sources = sources
    this.#bytes = new KeyedLoads((url) => {
      const cancel = new AbortController()
      // The read starts inside the guard, so a source that throws before
      // returning its promise fails the read ahead as a rejection: the
      // entry and its cancel are recorded together, never a cancel alone.
      const read = startPromise(() =>
        this.#sources.fetchModel(url, { priority: 'low', signal: cancel.signal }),
      )
      this.#cancels.set(url, cancel)
      // A read ahead that fails is nobody's failure while it waits for a
      // taker: its rejection is handled here, so it never reaches the page
      // as an error, and a load that takes the bytes over attaches its own
      // fallback to the same promise.
      void read.catch(() => undefined)
      return read
    })
    this.#models = new KeyedLoads((url) => {
      // The entry borrows the decoders through parsing AND result disposal,
      // including intentionally uncancelled work after its canvas retires.
      this.#leases += 1
      return loadProductModel(this.#sources, url, () => this.#modelBytes(url))
    })
  }

  // The live model load of the URL, started on its first read.
  readModel(url: string): ProductModelEntry {
    this.#assertActive()
    return this.#models.read(url)
  }

  // Releases a model load whose last hold is gone: forgotten now, so the
  // next read loads fresh, and what it created is released once it settles.
  releaseModel(entry: ProductModelEntry): void {
    if (!this.#models.forget(entry)) {
      return
    }
    this.#settling += 1
    void entry.value.then((load) => {
      try {
        releaseProductModel(load)
      } finally {
        this.#settling -= 1
        this.#leases -= 1
        this.#drain()
      }
    })
  }

  // The live read ahead of the URL, started on its first read.
  readAhead(url: string): KeyedLoad<ArrayBuffer> {
    this.#assertActive()
    return this.#bytes.read(url)
  }

  // Releases a read ahead whose last hold is gone. One a model load took
  // over is that load's now, and stays.
  releaseAhead(entry: KeyedLoad<ArrayBuffer>): void {
    if (this.#bytes.forget(entry)) {
      this.#retireCancel(entry.key).abort()
      this.#drain()
    }
  }

  // What the loads hold right now, in the automation's own terms.
  report(): ViewerLoads {
    return {
      models: this.#models.keys(),
      bytes: this.#bytes.keys(),
      settling: this.#settling,
    }
  }

  // End admission, retaining the decoder owner until every borrowing entry
  // has settled and disposed its result. Entry holds own their releases.
  retire(): void {
    this.#retired = true
    this.#drain()
  }

  #drain(): void {
    if (this.#retired && this.#leases === 0 && this.#cancels.size === 0 && !this.#disposed) {
      this.#disposed = true
      this.disposeDecoders()
    }
  }

  #assertActive(): void {
    if (this.#retired) {
      throw new Error('the model loads are retired: use the fresh canvas owner')
    }
  }

  // The bytes a model load reads: those of a read ahead it takes over, or
  // its own high-priority fetch. A taken read ahead that failed or was
  // cancelled is never handed over as the load's failure: the load reads
  // the file itself, so a speculative failure never fails a product.
  #modelBytes(url: string): Promise<ArrayBuffer> {
    const taken = this.#bytes.take(url)
    if (taken === undefined) {
      return this.#sources.fetchModel(url, { priority: 'high' })
    }
    this.#retireCancel(url)
    return taken.value.catch(() => this.#sources.fetchModel(url, { priority: 'high' }))
  }

  // Takes the cancel of a live read ahead out of the record, exactly once.
  #retireCancel(url: string): AbortController {
    const cancel = this.#cancels.get(url)
    if (cancel === undefined) {
      throw new Error(`internal error: the read ahead of ${url} has no cancel`)
    }
    this.#cancels.delete(url)
    return cancel
  }
}

// One model load, settled as its outcome. The model's bytes and its decoder
// start together, in the call itself, and the parse waits for both, so a
// load takes the slower of the two, never their sum. The bytes come from the
// caller's start where it hands one over (the bytes of a taken read ahead),
// and from a fresh high-priority fetch where it does not. Both starts run
// inside the load's guard, so every failure, the fetch, the decoder or the
// parse, and a start or a source that throws before returning its promise,
// settles as the load failure naming the model, whatever the underlying
// error says: a network error from the browser's fetch names no URL, and
// the product's failure must.
export function loadProductModel<Decoder>(
  sources: ProductModelSources<Decoder>,
  url: string,
  bytes: () => Promise<ArrayBuffer> = () => sources.fetchModel(url, { priority: 'high' }),
): Promise<ProductModelLoad> {
  return startPromise(() => Promise.all([bytes(), sources.decoder()]))
    .then(([data, decoder]) => sources.parse(data, url, decoder))
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
