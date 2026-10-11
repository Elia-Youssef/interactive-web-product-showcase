import { afterEach, describe, expect, it, vi } from 'vitest'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { DataTexture } from 'three/webgpu'
import { LoadLedger } from '@lib/async/loadLedger'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { createStageEnvironmentLoads } from './stageEnvironmentLoads'
import { deferred } from './product/stageModelLoads.fixtures'

afterEach(() => vi.restoreAllMocks())

// A loader progress event of plain values: the fields the reporter reads,
// on the one event Node can build.
function progressEvent(loaded: number, total: number): ProgressEvent {
  return Object.assign(new Event('progress'), { lengthComputable: true, loaded, total })
}

// The environment loads of a test, reporting into a ledger of their own.
function loads() {
  const ledger = new LoadLedger()
  return {
    ledger,
    loads: createStageEnvironmentLoads((url) => ledger.transfer(url, true)),
  }
}

describe('committed environment loads', () => {
  it('retains replayed and overlapping holders, then releases a pending HDR once', async () => {
    const pending = deferred<DataTexture>()
    const load = vi.spyOn(HDRLoader.prototype, 'loadAsync').mockReturnValue(pending.promise)
    const texture = new DataTexture()
    const dispose = vi.spyOn(texture, 'dispose')
    const flush: (() => void)[] = []
    const holds = new ResourceHolds<object>((callback) => flush.push(callback))
    const created = loads()
    const theLoads = created.loads
    const entry = theLoads.read('/env/test.hdr')
    const release = () => theLoads.release(entry)
    holds.hold(entry)
    holds.drop(entry, release)
    expect(theLoads.read(entry.key)).toBe(entry)
    holds.hold(entry)
    holds.hold(entry)
    for (const callback of flush.splice(0)) callback()
    holds.drop(entry, release)
    for (const callback of flush.splice(0)) callback()
    expect(theLoads.keys()).toEqual([entry.key])
    holds.drop(entry, release)
    for (const callback of flush.splice(0)) callback()
    expect(theLoads.keys()).toEqual([])
    expect(dispose).not.toHaveBeenCalled()
    pending.resolve(texture)
    await entry.value
    await Promise.resolve()
    theLoads.release(entry)
    expect(dispose).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
  })

  it('keeps the original failure promise for the stage boundary after release', async () => {
    const failure = new Error('the HDR request failed')
    vi.spyOn(HDRLoader.prototype, 'loadAsync').mockRejectedValue(failure)
    const created = loads()
    const entry = created.loads.read('/env/failed.hdr')
    created.loads.release(entry)
    await expect(entry.value).rejects.toBe(failure)
    expect(created.loads.keys()).toEqual([])
  })

  it('starts fresh stage caches and fresh entries after a released load', async () => {
    const load = vi
      .spyOn(HDRLoader.prototype, 'loadAsync')
      .mockImplementation(async () => new DataTexture())
    const first = loads().loads
    const second = loads().loads
    const entry = first.read('/env/test.hdr')
    expect(first.read(entry.key)).toBe(entry)
    expect(second.read(entry.key)).not.toBe(entry)
    first.release(entry)
    expect(first.read(entry.key)).not.toBe(entry)
    expect(load).toHaveBeenCalledTimes(3)
    await entry.value
  })

  it('reports the bytes its loader reads and the total it names, ending the transfer', async () => {
    const pending = deferred<DataTexture>()
    vi.spyOn(HDRLoader.prototype, 'loadAsync').mockImplementation(async (_url, onProgress) => {
      if (onProgress !== undefined) {
        onProgress(progressEvent(500, 2000))
      }
      return pending.promise
    })
    const created = loads()

    const entry = created.loads.read('/env/test.hdr')
    await Promise.resolve()
    expect(created.ledger.read().fraction).toBe(0.25)

    pending.resolve(new DataTexture())
    await entry.value
    // The transfer ended with its bytes fully in: the figure holds nothing
    // while decode and the settle still run.
    expect(created.ledger.read().fraction).toBeNull()
  })
})
