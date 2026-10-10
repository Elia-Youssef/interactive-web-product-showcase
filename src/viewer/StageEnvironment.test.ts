import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scene, Texture } from 'three/webgpu'
import { StageEnvironment } from './StageEnvironment'

const hooks = vi.hoisted(() => ({
  effect: vi.fn<(setup: () => (() => void) | undefined) => void>(),
  useThree: vi.fn(),
  use: vi.fn(),
  construct: vi.fn(),
  prefilter: vi.fn(),
  generatorDispose: vi.fn(),
  settle: vi.fn<() => Promise<void>>(),
}))

vi.mock('react', () => ({ useEffect: hooks.effect, use: hooks.use }))
vi.mock('@react-three/fiber', () => ({ useThree: hooks.useThree }))
vi.mock('./stageEnvironmentProvider', () => ({ useStageEnvironmentEntry: () => ({ value: null }) }))
vi.mock('./stageIdentity', () => ({ isStageRenderer: () => true }))
vi.mock('./stageSettleContext', () => ({ useStageSettle: () => hooks.settle }))
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
  hooks.settle.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function effectFor(backend: string) {
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
  StageEnvironment({ onInstalled: installed })
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
