import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scene, Texture } from 'three/webgpu'
import { StageEnvironment } from './StageEnvironment'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import { StageRetiredError } from './StageRetiredError'

const hooks = vi.hoisted(() => {
  const directSettle: { call: (() => Promise<void>) | null } = { call: null }
  return {
    effect: vi.fn<(setup: () => (() => void) | undefined) => void>(),
    useThree: vi.fn(),
    use: vi.fn(),
    construct: vi.fn(),
    prefilter: vi.fn(),
    generatorDispose: vi.fn(),
    settle: vi.fn<() => Promise<void>>(),
    directSettle,
  }
})

vi.mock('react', () => ({ useEffect: hooks.effect, use: hooks.use }))
vi.mock('@react-three/fiber', () => ({ useThree: hooks.useThree }))
vi.mock('./stageEnvironmentProvider', () => ({ useStageEnvironmentEntry: () => ({ value: null }) }))
vi.mock('./stageIdentity', () => ({ isStageRenderer: () => true }))
vi.mock('./stageSettleContext', () => ({
  useStageSettle: () => () => (hooks.directSettle.call ?? hooks.settle)(),
}))
vi.mock('three/webgpu', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    PMREMGenerator: class {
      fromEquirectangular = hooks.prefilter
      dispose = hooks.generatorDispose
      constructor(renderer: object) {
        hooks.construct(renderer)
      }
    },
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  hooks.directSettle.call = null
  hooks.settle.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function effectFor(backend: string, onFailure?: (error: Error) => void) {
  const gl = {
    backend: backend === 'webgpu' ? { isWebGPUBackend: true } : { isWebGLBackend: true },
  }
  const scene = new Scene()
  const previous = new Texture()
  scene.environment = previous
  const stage = new Texture()
  const source = new Texture()
  const sourceDispose = vi.spyOn(source, 'dispose')
  const stageDispose = vi.spyOn(stage, 'dispose')
  const clone = vi.spyOn(stage, 'clone').mockReturnValue(source)
  const result = { texture: new Texture(), dispose: vi.fn() }
  hooks.useThree.mockReturnValueOnce(gl).mockReturnValueOnce(scene)
  hooks.use.mockReturnValue(stage)
  hooks.prefilter.mockReturnValue(result)
  const installed = vi.fn()
  StageEnvironment({ onInstalled: installed, onFailure })
  const setup = hooks.effect.mock.calls[0]?.[0]
  if (setup === undefined) {
    throw new Error('the environment effect was not registered')
  }
  return {
    setup,
    gl,
    scene,
    previous,
    clone,
    source,
    sourceDispose,
    stageDispose,
    result,
    installed,
  }
}

describe.each(['webgpu', 'webgl2'])('the %s stage environment effect', (backend) => {
  it('reports the original settle rejection once to its supplied owner', async () => {
    const report = vi.fn()
    const owned = effectFor(backend, report)
    const life = new FrameClock().createFrameLife()
    life.retire()
    const cause = await life.onceFrame().catch((error: unknown) => error)
    hooks.directSettle.call = () => new StageSettle(life).settle({ invalidate: () => undefined })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unhandled: unknown[] = []
    const record = (error: unknown) => unhandled.push(error)
    process.on('unhandledRejection', record)
    const cleanup = owned.setup()
    try {
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(unhandled).toEqual([])
      expect(report).toHaveBeenCalledExactlyOnceWith(cause)
      expect(logged).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', record)
      cleanup?.()
    }
  })

  it.each([
    { supply: 'pending', reason: 'retired' },
    { supply: 'closed', reason: 'retired' },
    { supply: 'pending', reason: 'disposed' },
    { supply: 'closed', reason: 'disposed' },
  ] as const)(
    'routes a $supply $reason frame supply without an unhandled promise',
    async ({ supply, reason }) => {
      const owned = effectFor(backend)
      const life = new FrameClock().createFrameLife()
      const settle = new StageSettle(life)
      const unhandled: unknown[] = []
      const record = (cause: unknown) => unhandled.push(cause)
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      let started: () => void = () => undefined
      const firstFrame = new Promise<void>((resolve) => {
        started = resolve
      })
      // A mock function observes its result. Use the real call directly so
      // removing the production handler leaves the promise truly unowned.
      hooks.directSettle.call = () => settle.settle({ invalidate: started })
      if (supply === 'closed') {
        life[reason === 'retired' ? 'retire' : 'dispose']()
      }
      process.on('unhandledRejection', record)
      const cleanup = owned.setup()
      try {
        await firstFrame
        life[reason === 'retired' ? 'retire' : 'dispose']()
        // Node emits unhandled rejections after the promise jobs of this turn.
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(unhandled).toEqual([])
        if (reason === 'retired') {
          expect(logged).toHaveBeenCalledExactlyOnceWith(expect.any(StageRetiredError))
          expect(logged.mock.calls[0]?.[0]).toMatchObject({ reason })
        } else {
          expect(logged).not.toHaveBeenCalled()
        }
      } finally {
        process.off('unhandledRejection', record)
        cleanup?.()
      }
    },
  )

  it('keeps an unexpected settle failure loud without rejecting a derived promise', async () => {
    const owned = effectFor(backend)
    const cause = new Error('environment settle failed')
    hooks.directSettle.call = () => Promise.reject(cause)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unhandled: unknown[] = []
    const record = (error: unknown) => unhandled.push(error)
    process.on('unhandledRejection', record)
    const cleanup = owned.setup()
    try {
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(unhandled).toEqual([])
      expect(logged).toHaveBeenCalledExactlyOnceWith(cause)
    } finally {
      process.off('unhandledRejection', record)
      cleanup?.()
    }
  })

  it.each(['clone', 'PMREM construction', 'prefilter', 'assignment'])(
    'cleans up each acquired resource once and rethrows failed %s',
    (boundary) => {
      const owned = effectFor(backend)
      const failure = new Error(`failed ${boundary}`)
      const fail = () => {
        throw failure
      }
      switch (boundary) {
        case 'clone':
          owned.clone.mockImplementationOnce(fail)
          break
        case 'PMREM construction':
          hooks.construct.mockImplementationOnce(fail)
          break
        case 'prefilter':
          hooks.prefilter.mockImplementationOnce(fail)
          break
        case 'assignment':
          Object.defineProperty(owned.scene, 'environment', {
            get: () => owned.previous,
            set: fail,
          })
          break
      }
      let caught: unknown
      try {
        owned.setup()
      } catch (error) {
        caught = error
      }
      expect(caught).toBe(failure)
      expect(owned.sourceDispose).toHaveBeenCalledTimes(boundary === 'clone' ? 0 : 1)
      expect(hooks.generatorDispose).toHaveBeenCalledTimes(
        boundary === 'prefilter' || boundary === 'assignment' ? 1 : 0,
      )
      expect(owned.result.dispose).toHaveBeenCalledTimes(boundary === 'assignment' ? 1 : 0)
      expect(owned.stageDispose).not.toHaveBeenCalled()
      expect(hooks.settle).not.toHaveBeenCalled()
      expect(owned.installed).not.toHaveBeenCalled()
    },
  )

  it('disposes the generator immediately and hands off the environment until effect cleanup', () => {
    const owned = effectFor(backend)
    const cleanup = owned.setup()
    expect(hooks.construct).toHaveBeenCalledWith(owned.gl)
    expect(hooks.prefilter).toHaveBeenCalledWith(owned.source)
    expect(hooks.generatorDispose).toHaveBeenCalledTimes(1)
    expect(owned.scene.environment).toBe(owned.result.texture)
    expect(owned.result.dispose).not.toHaveBeenCalled()
    expect(owned.sourceDispose).not.toHaveBeenCalled()
    expect(hooks.settle).toHaveBeenCalledTimes(1)
    expect(owned.installed).toHaveBeenCalledWith(true)
    expect(cleanup).toBeTypeOf('function')
    cleanup?.()
    expect(owned.scene.environment).toBe(owned.previous)
    expect(owned.result.dispose).toHaveBeenCalledTimes(1)
    expect(owned.sourceDispose).toHaveBeenCalledTimes(1)
    expect(hooks.generatorDispose).toHaveBeenCalledTimes(1)
    expect(owned.stageDispose).not.toHaveBeenCalled()
    expect(owned.installed.mock.calls).toEqual([[true], [false]])
  })
})
