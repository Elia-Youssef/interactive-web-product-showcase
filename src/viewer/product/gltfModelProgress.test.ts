import { afterEach, describe, expect, it, vi } from 'vitest'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { LoadLedger, type ByteProgress } from '@lib/async/loadLedger'
import { createGltfModelSources, type GltfModelSourceParts } from './gltfModelSources'

// The byte progress of the model fetch: the stream reports into the
// transfer the request carries, the length the response names is the total
// it reports, and a response that names none leaves the total unknown. The
// stand-in fetch answers streams the test builds, so the reports are the
// ones the real read sees. The bytes are arbitrary: the fetch never parses.

const modelUrl = 'http://models.test/models/sample/model.glb'

const whole = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])

function sources(parts: GltfModelSourceParts = {}) {
  return createGltfModelSources(new KTX2Loader(), parts)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the model bytes progress', () => {
  it('reports the bytes read and the length the response names, and ends the transfer', async () => {
    const ledger = new LoadLedger()
    const readings: ByteProgress[] = []
    const progress = ledger.transfer(modelUrl, true)
    const { fetchModel } = sources({
      fetch: () =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(whole.slice(0, 4))
                controller.enqueue(whole.slice(4))
                controller.close()
              },
            }),
            {
              headers: { 'Content-Length': String(whole.byteLength) },
            },
          ),
        ),
    })

    const bytes = await fetchModel(modelUrl, {
      priority: 'high',
      progress: {
        bytes: (reading) => {
          readings.push({ ...reading })
          progress.bytes(reading)
        },
        ended: progress.ended,
      },
    })

    expect(bytes.byteLength).toBe(whole.byteLength)
    expect(readings[readings.length - 1]).toEqual({
      loaded: whole.byteLength,
      total: whole.byteLength,
    })
    // The transfer ended with its bytes fully in: the ledger holds no
    // figure while the decode that follows still runs.
    expect(ledger.read().fraction).toBeNull()
  })

  it('ends the transfer when the fetch itself rejects', async () => {
    const ended: number[] = []
    const failure = new TypeError('Failed to fetch')
    const { fetchModel } = sources({
      fetch: () => Promise.reject(failure),
    })

    await expect(
      fetchModel(modelUrl, {
        priority: 'high',
        progress: { bytes: () => undefined, ended: () => ended.push(1) },
      }),
    ).rejects.toBe(failure)
    expect(ended).toEqual([1])
  })

  it('reports no total for a response whose length names compressed bytes', async () => {
    const readings: ByteProgress[] = []
    const { fetchModel } = sources({
      fetch: () =>
        Promise.resolve(
          new Response(whole.slice(0), {
            headers: { 'Content-Length': String(whole.byteLength), 'Content-Encoding': 'br' },
          }),
        ),
    })

    await fetchModel(modelUrl, {
      priority: 'high',
      progress: {
        bytes: (reading) => readings.push({ ...reading }),
        ended: () => undefined,
      },
    })

    expect(readings.length).toBeGreaterThan(0)
    for (const reading of readings) {
      expect(reading.total).toBeNull()
    }
  })

  it('reports no total for a response that names none', async () => {
    const readings: ByteProgress[] = []
    const { fetchModel } = sources({
      fetch: () => Promise.resolve(new Response(whole.slice(0))),
    })

    await fetchModel(modelUrl, {
      priority: 'high',
      progress: {
        bytes: (reading) => readings.push({ ...reading }),
        ended: () => undefined,
      },
    })

    expect(readings.length).toBeGreaterThan(0)
    for (const reading of readings) {
      expect(reading.total).toBeNull()
      expect(reading.loaded).toBe(whole.byteLength)
    }
  })
})
