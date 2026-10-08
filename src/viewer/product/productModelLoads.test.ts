import { describe, expect, it } from 'vitest'
import { Object3D } from 'three/webgpu'
import { RetriedLoad } from '@lib/async/retriedLoad'
import {
  createProductModelLoads,
  loadProductModel,
  type LoadedModel,
  type ProductModelSources,
} from './productModelLoads'

// The model load's ordering and failure mapping, over sources whose
// promises the test settles by hand: no network, no loader, no clock.

type Decoder = { readonly name: string }

function deferred<Value>(): {
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

function model(): LoadedModel {
  return {
    scene: new Object3D(),
    animations: [],
    parser: { json: {}, associations: new Map(), getDependency: () => Promise.resolve(null) },
    userData: {},
  }
}

// Sources that record every call and parse anything into a fresh model.
function recordingSources(decoder: () => Promise<Decoder>): {
  readonly sources: ProductModelSources<Decoder>
  readonly fetched: string[]
  readonly parsedWith: Decoder[]
} {
  const fetched: string[] = []
  const parsedWith: Decoder[] = []
  return {
    sources: {
      fetchModel: (url) => {
        fetched.push(url)
        return Promise.resolve(new ArrayBuffer(4))
      },
      decoder,
      parse: (_bytes, _url, used) => {
        parsedWith.push(used)
        return Promise.resolve(model())
      },
    },
    fetched,
    parsedWith,
  }
}

const url = '/models/sample-one/model.glb'

describe('loadProductModel', () => {
  it('starts the model bytes and the decoder together, before either resolves', async () => {
    const bytes = deferred<ArrayBuffer>()
    const decoder = deferred<Decoder>()
    const started: string[] = []
    const parsed: string[] = []
    const load = loadProductModel<Decoder>(
      {
        fetchModel: (requested) => {
          started.push(`bytes of ${requested}`)
          return bytes.promise
        },
        decoder: () => {
          started.push('decoder')
          return decoder.promise
        },
        parse: (_bytes, _url, used) => {
          parsed.push(used.name)
          return Promise.resolve(model())
        },
      },
      url,
    )

    expect(started).toEqual([`bytes of ${url}`, 'decoder'])
    bytes.resolve(new ArrayBuffer(4))
    await Promise.resolve()
    expect(parsed).toEqual([])
    decoder.resolve({ name: 'meshopt' })

    expect((await load).kind).toBe('loaded')
    expect(parsed).toEqual(['meshopt'])
  })

  it('settles every failed source as the load failure naming the model URL', async () => {
    const failures: readonly (readonly [string, Partial<ProductModelSources<Decoder>>])[] = [
      ['the fetch', { fetchModel: () => Promise.reject(new TypeError('Failed to fetch')) }],
      ['the decoder', { decoder: () => Promise.reject(new TypeError('Failed to fetch')) }],
      ['the parse', { parse: () => Promise.reject(new TypeError('Failed to fetch')) }],
      [
        'a source that throws',
        {
          fetchModel: () => {
            throw new TypeError('Failed to fetch')
          },
        },
      ],
    ]
    for (const [label, broken] of failures) {
      const { sources } = recordingSources(() => Promise.resolve({ name: 'meshopt' }))
      const load = await loadProductModel({ ...sources, ...broken }, url)

      expect(load, label).toEqual({
        kind: 'failed',
        failure: { kind: 'load', url, message: 'Failed to fetch' },
      })
    }
  })
})

describe('createProductModelLoads', () => {
  it('fails every load that met a failed decoder import with its own typed failure', async () => {
    const decoder = new RetriedLoad<Decoder>(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    )
    const { sources } = recordingSources(() => decoder.read())
    const loads = createProductModelLoads(sources)

    const first = loads.read('/models/a/model.glb')
    const second = loads.read('/models/b/model.glb')

    await expect(first.value).resolves.toEqual({
      kind: 'failed',
      failure: {
        kind: 'load',
        url: '/models/a/model.glb',
        message: 'Failed to fetch dynamically imported module',
      },
    })
    await expect(second.value).resolves.toEqual({
      kind: 'failed',
      failure: {
        kind: 'load',
        url: '/models/b/model.glb',
        message: 'Failed to fetch dynamically imported module',
      },
    })
  })

  it('imports the decoder again for a load after a failed import', async () => {
    let imports = 0
    const decoder = new RetriedLoad<Decoder>(() => {
      imports += 1
      return imports === 1
        ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
        : Promise.resolve({ name: 'meshopt' })
    })
    const recorded = recordingSources(() => decoder.read())
    const loads = createProductModelLoads(recorded.sources)

    const failed = loads.read('/models/a/model.glb')
    expect((await failed.value).kind).toBe('failed')
    loads.forget(failed)

    expect((await loads.read('/models/a/model.glb').value).kind).toBe('loaded')
    expect((await loads.read('/models/b/model.glb').value).kind).toBe('loaded')
    expect(imports).toBe(2)
    expect(recorded.parsedWith.map((used) => used.name)).toEqual(['meshopt', 'meshopt'])
  })
})
