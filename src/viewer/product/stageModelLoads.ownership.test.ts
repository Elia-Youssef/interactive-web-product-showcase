import { describe, expect, it, vi } from 'vitest'
import { StageModelLoads, type LoadedModel, type ProductModelSources } from './productModelLoads'
import { deferred, modelWithOneMesh, url, type Decoder } from './stageModelLoads.fixtures'

function ownedModels() {
  const bytes = deferred<ArrayBuffer>()
  const decoder = deferred<Decoder>()
  const parsed = deferred<LoadedModel>()
  const started = deferred<void>()
  const disposeDecoder = vi.fn()
  const parse = vi.fn(() => {
    expect(disposeDecoder).not.toHaveBeenCalled()
    started.resolve()
    return parsed.promise
  })
  const sources: ProductModelSources<Decoder> = {
    fetchModel: () => bytes.promise,
    decoder: () => decoder.promise,
    parse,
  }
  const loads = new StageModelLoads(sources, disposeDecoder)
  return { loads, bytes, decoder, parsed, started, parse, disposeDecoder }
}

describe('model decoder ownership', () => {
  it('retains a retired owner until its byte-only holds have cancelled their reads', () => {
    const owned = ownedModels()
    const ahead = owned.loads.readAhead(url)
    owned.loads.retire()
    expect(owned.disposeDecoder).not.toHaveBeenCalled()
    expect(owned.loads.report().bytes).toEqual([url])
    owned.loads.releaseAhead(ahead)
    expect(owned.disposeDecoder).toHaveBeenCalledOnce()
    expect(owned.loads.report()).toEqual({ models: [], bytes: [], settling: 0 })
  })

  it('keeps a taken neighbor alive through retirement while cancelling an untaken neighbor', async () => {
    const bytes = deferred<ArrayBuffer>()
    const decoder = deferred<Decoder>()
    const result = modelWithOneMesh()
    const disposeGeometry = vi.spyOn(result.geometry, 'dispose')
    const disposeDecoder = vi.fn()
    const requests: AbortSignal[] = []
    const fetch = vi.fn((_url: string, request: { readonly signal?: AbortSignal }) => {
      if (request.signal !== undefined) requests.push(request.signal)
      return bytes.promise
    })
    const loads = new StageModelLoads(
      {
        fetchModel: fetch,
        decoder: () => decoder.promise,
        parse: () => Promise.resolve(result.model),
      },
      disposeDecoder,
    )
    const taken = loads.readAhead(url)
    const unused = loads.readAhead('/models/unused/model.glb')
    const entry = loads.readModel(url)
    loads.releaseAhead(taken)
    loads.releaseAhead(unused)
    loads.releaseModel(entry)
    loads.retire()
    expect(requests.map((signal) => signal.aborted)).toEqual([false, true])
    expect(disposeDecoder).not.toHaveBeenCalled()
    bytes.resolve(new ArrayBuffer(4))
    decoder.resolve({ name: 'meshopt' })
    await entry.value
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeDecoder).toHaveBeenCalledOnce()
    expect(loads.report()).toEqual({ models: [], bytes: [], settling: 0 })
  })

  it.each(['bytes', 'decoder'] as const)(
    'keeps decoders through deferred %s and late parsing after retirement',
    async (last) => {
      const owned = ownedModels()
      const { loads, bytes, decoder, parsed, disposeDecoder, parse } = owned
      const result = modelWithOneMesh()
      const disposeGeometry = vi.spyOn(result.geometry, 'dispose')
      const entry = loads.readModel(url)
      if (last === 'bytes') decoder.resolve({ name: 'meshopt' })
      else bytes.resolve(new ArrayBuffer(4))
      loads.releaseModel(entry)
      loads.retire()
      expect(disposeDecoder).not.toHaveBeenCalled()
      bytes.resolve(new ArrayBuffer(4))
      decoder.resolve({ name: 'meshopt' })
      await owned.started.promise
      expect(parse).toHaveBeenCalledOnce()
      expect(disposeDecoder).not.toHaveBeenCalled()
      parsed.resolve(result.model)
      await entry.value
      await Promise.resolve()
      expect(disposeGeometry).toHaveBeenCalledOnce()
      expect(disposeDecoder).toHaveBeenCalledOnce()
      expect(disposeGeometry.mock.invocationCallOrder[0]).toBeLessThan(
        disposeDecoder.mock.invocationCallOrder[0] ?? 0,
      )
      loads.releaseModel(entry)
      loads.retire()
      expect(disposeGeometry).toHaveBeenCalledOnce()
      expect(disposeDecoder).toHaveBeenCalledOnce()
      expect(loads.report()).toEqual({ models: [], bytes: [], settling: 0 })
    },
  )

  it('keeps the decoder until every overlapping model result has been disposed', async () => {
    const owned = ownedModels()
    const first = owned.loads.readModel(url)
    const second = owned.loads.readModel('/models/another/model.glb')
    owned.bytes.resolve(new ArrayBuffer(4))
    owned.decoder.resolve({ name: 'meshopt' })
    owned.parsed.resolve(modelWithOneMesh().model)
    await Promise.all([first.value, second.value])
    owned.loads.retire()
    owned.loads.releaseModel(first)
    await Promise.resolve()
    expect(owned.disposeDecoder).not.toHaveBeenCalled()
    owned.loads.releaseModel(second)
    await Promise.resolve()
    expect(owned.disposeDecoder).toHaveBeenCalledOnce()
  })

  it('drains failed work without parsing and refuses new work after retirement', async () => {
    const owned = ownedModels()
    const entry = owned.loads.readModel(url)
    owned.loads.releaseModel(entry)
    owned.loads.retire()
    expect(() => owned.loads.readModel(url)).toThrow('retired')
    expect(() => owned.loads.readAhead(url)).toThrow('retired')
    owned.bytes.reject(new Error('offline'))
    expect((await entry.value).kind).toBe('failed')
    await Promise.resolve()
    expect(owned.parse).not.toHaveBeenCalled()
    expect(owned.disposeDecoder).toHaveBeenCalledOnce()
  })
})
