import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from 'three/webgpu'
import { LoadLedger, type TransferReporter } from '@lib/async/loadLedger'
import { plannedFinish } from '@lib/product/finishPlan.fixtures'
import type { FinishResolution } from './finishMaterials'
import {
  StageModelLoads,
  type LoadedModel,
  type ModelRequest,
  type ProductModelSources,
} from './productModelLoads'

// The stage's model loads over sources whose promises a test settles by
// hand: no network, no loader, no clock.

export type Decoder = { readonly name: string }

export const url = '/models/sample-one/model.glb'

export function deferred<Value>(): {
  readonly promise: Promise<Value>
  readonly resolve: (value: Value) => void
  readonly reject: (cause: Error) => void
} {
  let resolve: (value: Value) => void = () => undefined
  let reject: (cause: Error) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

export function model(): LoadedModel {
  return {
    scene: new Object3D(),
    animations: [],
    parser: { json: {}, associations: new Map(), getDependency: () => Promise.resolve(null) },
    userData: {},
  }
}

const resolvedFinish: FinishResolution = {
  kind: 'resolved',
  finishes: {
    plan: plannedFinish({}),
    materials: new Map(),
    rawMaterials: new Map(),
    sceneMaterials: new Set(),
  },
}

// A loaded model of one mesh, whose geometry records its disposal.
export function modelWithOneMesh(): {
  readonly model: LoadedModel
  readonly geometry: BufferGeometry
} {
  const geometry = new BufferGeometry()
  const scene = new Group().add(new Mesh(geometry, new MeshStandardMaterial()))
  return {
    model: {
      scene,
      animations: [],
      parser: { json: {}, associations: new Map(), getDependency: () => Promise.resolve(null) },
      userData: { finishMaterials: resolvedFinish },
    },
    geometry,
  }
}

// One answer of the stand-in fetch: what the fetch does with the request it
// was given, a throw before any promise included.
export type FetchAnswer = (request: ModelRequest) => Promise<ArrayBuffer>

export type StageParts = {
  readonly parse?: () => Promise<LoadedModel>
  // The fetch's answers, in the order the reads ask; they run out into a
  // resolved four-byte buffer.
  readonly answers?: FetchAnswer[]
  readonly decoder?: () => Promise<Decoder>
}

export type RecordedStage = {
  readonly loads: StageModelLoads<Decoder>
  // The ledger the stage's byte progress reports into, so a test can read
  // the figure its requests produced.
  readonly ledger: LoadLedger
  // Every fetch and decoder start, in the order they ran.
  readonly requests: readonly { readonly url: string; readonly request: ModelRequest }[]
  readonly starts: readonly string[]
}

// The stage's loads over hand-settled sources, recording every fetch with
// its request and every start in order, reporting its byte progress into a
// ledger of its own.
export function stage({
  parse = () => Promise.resolve(modelWithOneMesh().model),
  answers = [],
  decoder = () => Promise.resolve({ name: 'meshopt' }),
}: StageParts = {}): RecordedStage {
  const requests: { url: string; request: ModelRequest }[] = []
  const starts: string[] = []
  const ledger = new LoadLedger()
  const sources: ProductModelSources<Decoder> = {
    fetchModel: (requested, request) => {
      requests.push({ url: requested, request })
      starts.push(`${request.priority} bytes`)
      const answer = answers.shift()
      const read = answer === undefined ? Promise.resolve(new ArrayBuffer(4)) : answer(request)
      // The stand-in reads like a real one: the whole buffer arrives of a
      // total twice its size, so the ledger the stage reports into sees a
      // figure that is only half through, and a wanted transfer is
      // observable beside a not wanted one.
      return read.then((bytes) => {
        request.progress.bytes({ loaded: bytes.byteLength, total: bytes.byteLength * 2 })
        return bytes
      })
    },
    decoder: () => {
      starts.push('decoder')
      return decoder()
    },
    parse: (_bytes, _url, used) => {
      void used
      return parse()
    },
  }
  return {
    loads: new StageModelLoads(sources, (url, wanted) => ledger.transfer(url, wanted)),
    ledger,
    requests,
    starts,
  }
}

// A reporter nothing listens to, for the loads a test starts outside a
// stage: the stand-in for the ledger a real stage would hand.
export const unwatchedProgress: TransferReporter = {
  bytes: () => undefined,
  ended: () => undefined,
}

// Sources that record the decoder every parse used and parse anything into
// a fresh model.
export function recordingSources(decoder: () => Promise<Decoder>): {
  readonly sources: ProductModelSources<Decoder>
  readonly parsedWith: Decoder[]
} {
  const parsedWith: Decoder[] = []
  return {
    sources: {
      fetchModel: () => Promise.resolve(new ArrayBuffer(4)),
      decoder,
      parse: (_bytes, _url, used) => {
        parsedWith.push(used)
        return Promise.resolve(model())
      },
    },
    parsedWith,
  }
}

// An answer that settles only through the request's own signal: it rejects
// with the abort the cancel fires, and never settles otherwise.
export const abortableAnswer: FetchAnswer = (request) =>
  new Promise<ArrayBuffer>((_resolve, reject) => {
    request.signal?.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

export function throwingAnswer(message: string): FetchAnswer {
  return () => {
    throw new TypeError(message)
  }
}
