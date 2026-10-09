import { describe, expect, it } from 'vitest'
import { Object3D } from 'three/webgpu'
import { loadProductModel, type LoadedModel, type ProductModelSources } from './productModelLoads'

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

  it('reads the bytes of a taken read ahead instead of fetching them itself', async () => {
    const bytes = new ArrayBuffer(8)
    const parsed: ArrayBuffer[] = []
    let fresh = 0
    const load = loadProductModel<Decoder>(
      {
        fetchModel: () => {
          fresh += 1
          return Promise.resolve(new ArrayBuffer(4))
        },
        decoder: () => Promise.resolve({ name: 'meshopt' }),
        parse: (data) => {
          parsed.push(data)
          return Promise.resolve(model())
        },
      },
      url,
      () => Promise.resolve(bytes),
    )

    expect((await load).kind).toBe('loaded')
    expect(parsed).toEqual([bytes])
    expect(fresh).toBe(0)
  })

  it('settles every failed source as the load failure naming the model URL', async () => {
    const failures: readonly (readonly [string, Partial<ProductModelSources<Decoder>>])[] = [
      ['the fetch', { fetchModel: () => Promise.reject(new TypeError('Failed to fetch')) }],
      ['the decoder', { decoder: () => Promise.reject(new TypeError('Failed to fetch')) }],
      ['the parse', { parse: () => Promise.reject(new TypeError('Failed to fetch')) }],
      [
        'a fetch that throws',
        {
          fetchModel: () => {
            throw new TypeError('Failed to fetch')
          },
        },
      ],
      [
        'a decoder that throws',
        {
          decoder: () => {
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

  it('settles a bytes start that throws before returning its promise as the load failure', async () => {
    const { sources } = recordingSources(() => Promise.resolve({ name: 'meshopt' }))
    const load = loadProductModel(sources, url, () => {
      throw new TypeError('the read ahead is gone')
    })

    await expect(load).resolves.toEqual({
      kind: 'failed',
      failure: { kind: 'load', url, message: 'the read ahead is gone' },
    })
  })
})
