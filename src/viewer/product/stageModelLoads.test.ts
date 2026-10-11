import { describe, expect, it, vi } from 'vitest'
import { LoadLedger } from '@lib/async/loadLedger'
import { RetriedLoad } from '@lib/async/retriedLoad'
import { StageModelLoads, type LoadedModel } from './productModelLoads'
import {
  abortableAnswer,
  deferred,
  modelWithOneMesh,
  recordingSources,
  stage,
  url,
  type Decoder,
} from './stageModelLoads.fixtures'

// The stage's owner of the model loads: one load per model with its reads
// ahead, the handover of a taken read ahead, and the release of a load the
// stage left mid-flight, over sources whose promises the test settles by
// hand: no network, no loader, no clock.

describe('StageModelLoads', () => {
  it('starts one load per model and reads its file at high priority', () => {
    const { loads, requests } = stage()

    const first = loads.readModel(url)

    expect(loads.readModel(url)).toBe(first)
    expect(requests).toEqual([{ url, request: { priority: 'high', progress: expect.anything() } }])
    expect(loads.report()).toEqual({ models: [url], bytes: [], settling: 0 })
  })

  it('registers the read ahead as bytes nobody waits for, and the load as wanted', async () => {
    const { loads, ledger, requests } = stage()

    const ahead = loads.readAhead(url)
    await ahead.value
    expect(requests).toHaveLength(1)
    // The read ahead's bytes are in the ledger, and no figure counts them.
    expect(ledger.read().fraction).toBeNull()

    const model = loads.readModel(url)
    // The load takes the same transfer over: the same bytes now count,
    // with no second fetch.
    expect(ledger.read().fraction).toBe(0.5)
    await model.value
    expect(requests).toHaveLength(1)
  })

  it('reads a file ahead at low priority with a cancel, as bytes only', async () => {
    const { loads, requests } = stage({
      parse: () => {
        throw new Error('a read ahead parses nothing')
      },
    })

    const ahead = loads.readAhead(url)
    await ahead.value

    expect(requests).toEqual([
      {
        url,
        request: { priority: 'low', progress: expect.anything(), signal: expect.any(AbortSignal) },
      },
    ])
    expect(loads.report()).toEqual({ models: [], bytes: [url], settling: 0 })
  })

  it('hands the bytes read ahead to the model load of the same file, reading it once', async () => {
    const parse = vi.fn(() => Promise.resolve(modelWithOneMesh().model))
    const { loads, requests } = stage({ parse })

    const ahead = loads.readAhead(url)
    const model = loads.readModel(url)
    await model.value

    expect(requests).toHaveLength(1)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(loads.report()).toEqual({ models: [url], bytes: [], settling: 0 })
    // The read ahead the load took over is the load's: its release cancels
    // nothing.
    const signal = requests[0]?.request.signal
    loads.releaseAhead(ahead)
    expect(signal?.aborted).toBe(false)
  })

  it('reads the file itself when the read ahead it took over failed', async () => {
    // The first read, the read ahead, fails; every later read answers.
    const answers = [() => Promise.reject(new TypeError('offline'))]
    const { loads, requests } = stage({ answers })

    const ahead = loads.readAhead(url)
    void ahead.value.catch(() => undefined)
    const model = loads.readModel(url)

    expect((await model.value).kind).toBe('loaded')
    expect(requests).toEqual([
      {
        url,
        request: { priority: 'low', progress: expect.anything(), signal: expect.any(AbortSignal) },
      },
      { url, request: { priority: 'high', progress: expect.anything() } },
    ])
    expect(loads.report()).toEqual({ models: [url], bytes: [], settling: 0 })
  })

  it('keeps a failed read ahead nobody took over off the page errors', async () => {
    // The first read, the read ahead, fails with no taker: the rejection is
    // the owner's to hold, and a rejection without a handler surfaces as a
    // page error here, which fails this run.
    const answers = [() => Promise.reject(new TypeError('offline'))]
    const { loads, requests } = stage({ answers })

    loads.readAhead(url)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(loads.report()).toEqual({ models: [], bytes: [url], settling: 0 })
    expect(requests).toHaveLength(1)
  })

  it('reads the file itself when the read ahead it would take over was cancelled', async () => {
    // The first read settles only through its signal: it rejects when its
    // cancel fires, which the release does, and never settles otherwise.
    const { loads, requests } = stage({ answers: [abortableAnswer] })

    const ahead = loads.readAhead(url)
    loads.releaseAhead(ahead)
    void ahead.value.catch(() => undefined)
    const model = loads.readModel(url)

    expect((await model.value).kind).toBe('loaded')
    expect(requests).toEqual([
      {
        url,
        request: { priority: 'low', progress: expect.anything(), signal: expect.any(AbortSignal) },
      },
      { url, request: { priority: 'high', progress: expect.anything() } },
    ])
  })

  it('cancels and forgets a released read ahead, and reads the file anew on the next read', () => {
    const { loads, requests } = stage()

    const ahead = loads.readAhead(url)
    const signal = requests[0]?.request.signal
    loads.releaseAhead(ahead)

    expect(signal?.aborted).toBe(true)
    expect(loads.report().bytes).toEqual([])
    expect(loads.readAhead(url)).not.toBe(ahead)
    expect(requests).toHaveLength(2)
  })

  it('forgets a released load at once and releases what it created once it settles', async () => {
    const parse = deferred<LoadedModel>()
    const { loads } = stage({ parse: () => parse.promise })
    const { model, geometry } = modelWithOneMesh()
    const dispose = vi.spyOn(geometry, 'dispose')

    const entry = loads.readModel(url)
    loads.releaseModel(entry)

    // Released while still running: no live load, one release waiting.
    expect(loads.report()).toEqual({ models: [], bytes: [], settling: 1 })
    expect(dispose).not.toHaveBeenCalled()

    parse.resolve(model)
    await entry.value
    await Promise.resolve()

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(loads.report().settling).toBe(0)
  })

  it('starts a fresh load for a model whose load was released', () => {
    const { loads, requests } = stage()

    const first = loads.readModel(url)
    loads.releaseModel(first)

    expect(loads.readModel(url)).not.toBe(first)
    expect(requests).toHaveLength(2)
  })

  it('fails every load that met a failed decoder import with its own typed failure', async () => {
    const decoder = new RetriedLoad<Decoder>(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    )
    const recorded = recordingSources(() => decoder.read())
    const ledger = new LoadLedger()
    const loads = new StageModelLoads(recorded.sources, (requested, wanted) =>
      ledger.transfer(requested, wanted),
    )

    const first = loads.readModel('/models/a/model.glb')
    const second = loads.readModel('/models/b/model.glb')

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
    const ledger = new LoadLedger()
    const loads = new StageModelLoads(recorded.sources, (requested, wanted) =>
      ledger.transfer(requested, wanted),
    )

    const failed = loads.readModel('/models/a/model.glb')
    expect((await failed.value).kind).toBe('failed')
    loads.releaseModel(failed)
    await Promise.resolve()

    expect((await loads.readModel('/models/a/model.glb').value).kind).toBe('loaded')
    expect((await loads.readModel('/models/b/model.glb').value).kind).toBe('loaded')
    expect(imports).toBe(2)
    expect(recorded.parsedWith.map((used) => used.name)).toEqual(['meshopt', 'meshopt'])
  })
})
