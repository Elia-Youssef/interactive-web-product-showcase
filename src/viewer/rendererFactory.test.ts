import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBackendRequest } from '@lib/renderer/request'
import * as detection from '@lib/renderer/detect'
import { initFailureReason, StageRendererStartError } from '@lib/renderer/initFailure'
import * as identity from './stageIdentity'
import { createStageRenderer } from './rendererFactory'

const controls = vi.hoisted(() => {
  const state: { backend: object | undefined } = { backend: { isWebGPUBackend: true } }
  return {
    ...state,
    construct: vi.fn(),
    init: vi.fn<() => Promise<void>>(),
    dispose: vi.fn<() => Promise<void>>(),
  }
})

vi.mock('three/webgpu', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  WebGPURenderer: class {
    backend = controls.backend
    init = controls.init
    dispose = controls.dispose
    constructor(options: object) {
      controls.construct(options)
    }
  },
}))

class TestCanvas extends EventTarget {}

beforeEach(() => {
  vi.stubGlobal('HTMLCanvasElement', TestCanvas)
  controls.backend = { isWebGPUBackend: true }
  controls.construct.mockReset()
  controls.init.mockReset().mockResolvedValue(undefined)
  controls.dispose.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const requests = ['', '?backend=webgl']

describe.each(requests)('renderer acquisition for %s', (query) => {
  it.each(['construction', 'init throw', 'init rejection', 'type', 'backend'])(
    'releases only acquired resources after a %s failure and preserves the error',
    async (boundary) => {
      const failure = new Error(`failed ${boundary}`)
      const fail = () => {
        throw failure
      }
      switch (boundary) {
        case 'construction':
          controls.construct.mockImplementationOnce(fail)
          break
        case 'init throw':
          controls.init.mockImplementationOnce(fail)
          break
        case 'init rejection':
          controls.init.mockRejectedValueOnce(failure)
          break
        case 'type':
          vi.spyOn(identity, 'assertStageRenderer').mockImplementationOnce(fail)
          break
        case 'backend':
          vi.spyOn(detection, 'detectRendererBackend').mockImplementationOnce(fail)
          break
      }
      const start = createStageRenderer(parseBackendRequest(query))

      await expect(start.factory({ canvas: new TestCanvas() })).rejects.toBe(failure)

      expect(controls.construct).toHaveBeenCalledTimes(1)
      expect(controls.dispose).toHaveBeenCalledTimes(boundary === 'construction' ? 0 : 1)
      expect(start.started()).toBeNull()
    },
  )

  it.each([undefined, {}, { isWebGPUBackend: true, isWebGLBackend: true }])(
    'releases a renderer rejected by real backend detection: %j',
    async (backend) => {
      controls.backend = backend
      const start = createStageRenderer(parseBackendRequest(query))
      await expect(start.factory({ canvas: new TestCanvas() })).rejects.toThrow(/backend/)
      expect(controls.dispose).toHaveBeenCalledTimes(1)
      expect(start.started()).toBeNull()
    },
  )
})

it.each([
  { query: '', backend: { isWebGPUBackend: true }, expected: 'webgpu' },
  { query: '', backend: { isWebGLBackend: true }, expected: 'webgl2' },
  { query: '?backend=webgl', backend: { isWebGLBackend: true }, expected: 'webgl2' },
])('hands off the live renderer on $query with $expected', async ({ query, backend, expected }) => {
  controls.backend = backend
  const start = createStageRenderer(parseBackendRequest(query))
  const canvas = new TestCanvas()
  const renderer = await start.factory({ canvas })

  expect(controls.construct).toHaveBeenCalledWith(
    expect.objectContaining({ canvas, forceWebGL: query !== '' }),
  )
  expect(controls.init).toHaveBeenCalledTimes(1)
  expect(start.started()).toEqual({ renderer, backend: expected })
  expect(controls.dispose).not.toHaveBeenCalled()

  await renderer.dispose()
  expect(controls.dispose).toHaveBeenCalledTimes(1)
})

it('waits for the rollback and carries its failure when asynchronous disposal rejects', async () => {
  const failure = new Error('init failed')
  controls.init.mockRejectedValueOnce(failure)
  let rejectDisposal: (reason: Error) => void = () => {
    throw new Error('disposal has not started')
  }
  controls.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        rejectDisposal = reject
      }),
  )
  const start = createStageRenderer(parseBackendRequest(''))
  const rejected = start.factory({ canvas: new TestCanvas() }).then(
    () => {
      throw new Error('the factory must reject')
    },
    (reason: unknown) => reason,
  )
  await Promise.resolve()
  expect(controls.dispose).toHaveBeenCalledTimes(1)
  expect(start.started()).toBeNull()
  const rollbackFailure = new Error('dispose failed')
  rejectDisposal(rollbackFailure)
  const error = await rejected
  if (!(error instanceof StageRendererStartError)) {
    throw new Error('the rejection must carry the rollback failure with the start failure')
  }
  expect(error.startup).toBe(failure)
  expect(error.rollback).toBe(rollbackFailure)
})

// Where a failed start can come from, as one installation per fault. The
// rollback reporting must hold for the whole class, not only a failed init.
const startFaults: readonly { readonly name: string; readonly fail: (failure: Error) => void }[] = [
  {
    name: 'init rejection',
    fail: (failure) => {
      controls.init.mockRejectedValueOnce(failure)
    },
  },
  {
    name: 'renderer identity assertion',
    fail: (failure) => {
      vi.spyOn(identity, 'assertStageRenderer').mockImplementationOnce(() => {
        throw failure
      })
    },
  },
]

describe.each(startFaults)('a start that fails at its $name', ({ fail }) => {
  it('keeps the start failure as the whole report when the rollback succeeds', async () => {
    const failure = new Error('the start failed')
    fail(failure)
    const start = createStageRenderer(parseBackendRequest(''))

    const error = await start.factory({ canvas: new TestCanvas() }).then(
      () => {
        throw new Error('the factory must reject')
      },
      (reason: unknown) => reason,
    )

    expect(controls.dispose).toHaveBeenCalledTimes(1)
    expect(start.started()).toBeNull()
    expect(error).toBe(failure)
  })

  it('carries a rollback failure with the start failure, the start failure first', async () => {
    const failure = new Error('the start failed')
    fail(failure)
    const rollbackFailure = new Error('the rollback failed')
    controls.dispose.mockRejectedValueOnce(rollbackFailure)
    const start = createStageRenderer(parseBackendRequest(''))

    const error = await start.factory({ canvas: new TestCanvas() }).then(
      () => {
        throw new Error('the factory must reject')
      },
      (reason: unknown) => reason,
    )

    expect(controls.dispose).toHaveBeenCalledTimes(1)
    expect(start.started()).toBeNull()
    if (!(error instanceof StageRendererStartError)) {
      throw new Error('the rejection must carry the rollback failure with the start failure')
    }
    expect(error.startup).toBe(failure)
    expect(error.rollback).toBe(rollbackFailure)
    expect(error.message).toBe(failure.message)
    const reason = initFailureReason(error)
    expect(reason).toContain(failure.message)
    expect(reason).toContain(rollbackFailure.message)
    expect(reason.indexOf(rollbackFailure.message)).toBeGreaterThan(reason.indexOf(failure.message))
  })

  it('reports the start failure once when the rollback rejects with the same error', async () => {
    const failure = new Error('the start failed')
    fail(failure)
    controls.dispose.mockRejectedValueOnce(failure)
    const start = createStageRenderer(parseBackendRequest(''))

    const error = await start.factory({ canvas: new TestCanvas() }).then(
      () => {
        throw new Error('the factory must reject')
      },
      (reason: unknown) => reason,
    )

    expect(controls.dispose).toHaveBeenCalledTimes(1)
    expect(start.started()).toBeNull()
    if (!(error instanceof Error)) {
      throw new Error('the factory must reject with an Error')
    }
    expect(error).toBe(failure)
    const reason = initFailureReason(error)
    expect(reason.indexOf(failure.message)).toBe(reason.lastIndexOf(failure.message))
  })
})

it('reports a non-Error start failure once when the rollback rejects with that same value', async () => {
  const failure = 'the start failed'
  controls.init.mockRejectedValueOnce(failure)
  controls.dispose.mockRejectedValueOnce(failure)
  const start = createStageRenderer(parseBackendRequest(''))

  const error = await start.factory({ canvas: new TestCanvas() }).then(
    () => {
      throw new Error('the factory must reject')
    },
    (reason: unknown) => reason,
  )

  expect(controls.dispose).toHaveBeenCalledTimes(1)
  if (!(error instanceof Error)) {
    throw new Error('the factory must reject with an Error')
  }
  expect(error).not.toBeInstanceOf(StageRendererStartError)
  expect(error.message).toBe(failure)
  const reason = initFailureReason(error)
  expect(reason.indexOf(failure)).toBe(reason.lastIndexOf(failure))
})

it('refuses a start error whose rollback failure is the start failure itself', () => {
  const failure = new Error('the same failure')
  expect(() => new StageRendererStartError(failure, failure)).toThrow(
    /must not carry its own error/,
  )
})

it('rejects invalid requests and canvases before acquiring a renderer', async () => {
  const invalid = createStageRenderer(parseBackendRequest('?backend=bogus'))
  await expect(invalid.factory({ canvas: new TestCanvas() })).rejects.toThrow(/invalid request/)
  const valid = createStageRenderer(parseBackendRequest(''))
  await expect(valid.factory({ canvas: new EventTarget() })).rejects.toThrow(/HTMLCanvasElement/)
  expect(controls.construct).not.toHaveBeenCalled()
  expect(controls.dispose).not.toHaveBeenCalled()
})
