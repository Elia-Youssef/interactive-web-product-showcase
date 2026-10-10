import { afterEach, describe, expect, it, vi } from 'vitest'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { DataTexture } from 'three/webgpu'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { createStageEnvironmentLoads } from './stageEnvironmentLoads'
import { deferred } from './product/stageModelLoads.fixtures'

afterEach(() => vi.restoreAllMocks())

describe('committed environment loads', () => {
  it('retains replayed and overlapping holders, then releases a pending HDR once', async () => {
    const pending = deferred<DataTexture>()
    const load = vi.spyOn(HDRLoader.prototype, 'loadAsync').mockReturnValue(pending.promise)
    const texture = new DataTexture()
    const dispose = vi.spyOn(texture, 'dispose')
    const flush: (() => void)[] = []
    const holds = new ResourceHolds<object>((callback) => flush.push(callback))
    const loads = createStageEnvironmentLoads()
    const entry = loads.read('/env/test.hdr')
    const release = () => loads.release(entry)
    holds.hold(entry)
    holds.drop(entry, release)
    expect(loads.read(entry.key)).toBe(entry)
    holds.hold(entry)
    holds.hold(entry)
    for (const callback of flush.splice(0)) callback()
    holds.drop(entry, release)
    for (const callback of flush.splice(0)) callback()
    expect(loads.keys()).toEqual([entry.key])
    holds.drop(entry, release)
    for (const callback of flush.splice(0)) callback()
    expect(loads.keys()).toEqual([])
    expect(dispose).not.toHaveBeenCalled()
    pending.resolve(texture)
    await entry.value
    await Promise.resolve()
    loads.release(entry)
    expect(dispose).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
  })

  it('keeps the original failure promise for the stage boundary after release', async () => {
    const failure = new Error('the HDR request failed')
    vi.spyOn(HDRLoader.prototype, 'loadAsync').mockRejectedValue(failure)
    const loads = createStageEnvironmentLoads()
    const entry = loads.read('/env/failed.hdr')
    loads.release(entry)
    await expect(entry.value).rejects.toBe(failure)
    expect(loads.keys()).toEqual([])
  })

  it('starts fresh stage caches and fresh entries after a released load', async () => {
    const load = vi
      .spyOn(HDRLoader.prototype, 'loadAsync')
      .mockImplementation(async () => new DataTexture())
    const first = createStageEnvironmentLoads()
    const second = createStageEnvironmentLoads()
    const entry = first.read('/env/test.hdr')
    expect(first.read(entry.key)).toBe(entry)
    expect(second.read(entry.key)).not.toBe(entry)
    first.release(entry)
    expect(first.read(entry.key)).not.toBe(entry)
    expect(load).toHaveBeenCalledTimes(3)
    await entry.value
  })
})
