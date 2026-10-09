import { describe, expect, it } from 'vitest'
import { deferred, stage, throwingAnswer, url, type Decoder } from './stageModelLoads.fixtures'

// The owner's loads over sources that throw before returning their
// promise, on every path a load's bytes take: a fresh fetch, the bytes of a
// taken read ahead, and the read ahead itself. Each settles in the one
// channel the owner answers in, a typed load failure or a read ahead the
// load does not hand over, and never throws out of a read. The order the
// bytes and the decoder start in is pinned at this level too, on both
// paths a load's bytes take.

const failedLoad = (message: string) => ({
  kind: 'failed',
  failure: { kind: 'load', url, message },
})

describe('StageModelLoads over a source that throws', () => {
  it('settles a fresh fetch that throws as the load failure, never a throw from the read', async () => {
    const { loads } = stage({ answers: [throwingAnswer('the fetch broke')] })

    const entry = loads.readModel(url)

    await expect(entry.value).resolves.toEqual(failedLoad('the fetch broke'))
  })

  it('settles a decoder that throws as the load failure, never a throw from the read', async () => {
    const { loads } = stage({
      decoder: () => {
        throw new TypeError('the decoder broke')
      },
    })

    await expect(loads.readModel(url).value).resolves.toEqual(failedLoad('the decoder broke'))
  })

  it('keeps a read ahead whose source throws as a failed read, with its entry and its cancel', () => {
    const { loads, requests } = stage({ answers: [throwingAnswer('the read ahead broke')] })

    const ahead = loads.readAhead(url)

    expect(loads.report().bytes).toEqual([url])
    // The cancel was recorded with the entry: the release finds it and
    // fires it, and nothing is left behind.
    loads.releaseAhead(ahead)
    expect(requests[0]?.request.signal?.aborted).toBe(true)
    expect(loads.report().bytes).toEqual([])
  })

  it('reads the file itself when the read ahead it takes over had a source that threw', async () => {
    const { loads, requests } = stage({ answers: [throwingAnswer('the read ahead broke')] })

    loads.readAhead(url)
    const model = loads.readModel(url)

    expect((await model.value).kind).toBe('loaded')
    expect(requests.map(({ request }) => request.priority)).toEqual(['low', 'high'])
    expect(loads.report()).toEqual({ models: [url], bytes: [], settling: 0 })
  })

  it('settles a taken read ahead whose fallback fetch throws as the load failure', async () => {
    const { loads } = stage({
      answers: [() => Promise.reject(new TypeError('offline')), throwingAnswer('still offline')],
    })

    loads.readAhead(url)

    await expect(loads.readModel(url).value).resolves.toEqual(failedLoad('still offline'))
  })
})

describe('StageModelLoads start order', () => {
  it('starts the fresh bytes and the decoder in the read itself, before either settles', () => {
    const bytes = deferred<ArrayBuffer>()
    const decoder = deferred<Decoder>()
    const { loads, starts } = stage({
      answers: [() => bytes.promise],
      decoder: () => decoder.promise,
    })

    loads.readModel(url)

    expect(starts).toEqual(['high bytes', 'decoder'])
  })

  it('starts the decoder in the read that takes a read ahead over, and parses once both settle', async () => {
    const bytes = deferred<ArrayBuffer>()
    const decoder = deferred<Decoder>()
    let parsed = 0
    const { loads, starts } = stage({
      answers: [() => bytes.promise],
      decoder: () => decoder.promise,
      parse: () => {
        parsed += 1
        return Promise.reject(new Error('parsed'))
      },
    })

    loads.readAhead(url)
    const model = loads.readModel(url)

    // The read ahead's bytes are still in flight; the decoder started with
    // the read, and no second fetch did.
    expect(starts).toEqual(['low bytes', 'decoder'])
    decoder.resolve({ name: 'meshopt' })
    await Promise.resolve()
    expect(parsed).toBe(0)
    bytes.resolve(new ArrayBuffer(4))
    expect((await model.value).kind).toBe('failed')
    expect(parsed).toBe(1)
  })
})
