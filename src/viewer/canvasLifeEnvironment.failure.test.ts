import { describe, expect, it, vi } from 'vitest'
import { Scene, Texture } from 'three/webgpu'
import { installCanvasLifeEnvironment } from './canvasLifeEnvironment'

function resources() {
  const scene = new Scene()
  const previous = new Texture()
  scene.environment = previous
  const stage = new Texture()
  const source = new Texture()
  const texture = new Texture()
  const sourceDispose = vi.spyOn(source, 'dispose')
  const stageDispose = vi.spyOn(stage, 'dispose')
  const previousDispose = vi.spyOn(previous, 'dispose')
  const clone = vi.spyOn(stage, 'clone').mockReturnValue(source)
  const dispose = vi.fn()
  const prefiltered = { texture, dispose }
  const prefilter = vi.fn(() => prefiltered)
  return {
    scene,
    previous,
    stage,
    source,
    texture,
    clone,
    sourceDispose,
    stageDispose,
    previousDispose,
    prefiltered,
    prefilter,
    dispose,
  }
}

describe('environment acquisition rollback', () => {
  it.each(['clone', 'prefilter', 'previous environment', 'result texture', 'assignment'])(
    'releases every acquired resource once after failed %s and keeps the original error',
    (boundary) => {
      const owned = resources()
      const failure = new Error(`failed ${boundary}`)
      const fail = () => {
        throw failure
      }
      switch (boundary) {
        case 'clone':
          owned.clone.mockImplementationOnce(fail)
          break
        case 'prefilter':
          owned.prefilter.mockImplementationOnce(fail)
          break
        case 'previous environment':
          Object.defineProperty(owned.scene, 'environment', { get: fail })
          break
        case 'result texture':
          Object.defineProperty(owned.prefiltered, 'texture', { get: fail })
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
        installCanvasLifeEnvironment({
          scene: owned.scene,
          stageTexture: owned.stage,
          prefilter: owned.prefilter,
        })
      } catch (error) {
        caught = error
      }
      expect(caught).toBe(failure)
      expect(owned.sourceDispose).toHaveBeenCalledTimes(boundary === 'clone' ? 0 : 1)
      expect(owned.dispose).toHaveBeenCalledTimes(
        boundary === 'clone' || boundary === 'prefilter' ? 0 : 1,
      )
      expect(owned.stageDispose).not.toHaveBeenCalled()
      expect(owned.previousDispose).not.toHaveBeenCalled()
    },
  )

  it('hands off its resources until the owner uninstalls them', () => {
    const owned = resources()
    const uninstall = installCanvasLifeEnvironment({
      scene: owned.scene,
      stageTexture: owned.stage,
      prefilter: owned.prefilter,
    })
    expect(owned.scene.environment).toBe(owned.texture)
    expect(owned.sourceDispose).not.toHaveBeenCalled()
    expect(owned.dispose).not.toHaveBeenCalled()
    uninstall()
    expect(owned.scene.environment).toBe(owned.previous)
    expect(owned.sourceDispose).toHaveBeenCalledTimes(1)
    expect(owned.dispose).toHaveBeenCalledTimes(1)
    expect(owned.stageDispose).not.toHaveBeenCalled()
    expect(owned.previousDispose).not.toHaveBeenCalled()
  })

  it('releases the source and preserves acquisition failure even if result disposal throws', () => {
    const owned = resources()
    const failure = new Error('assignment failed')
    Object.defineProperty(owned.scene, 'environment', {
      get: () => owned.previous,
      set: () => {
        throw failure
      },
    })
    owned.dispose.mockImplementationOnce(() => {
      throw new Error('result dispose failed')
    })
    let caught: unknown
    try {
      installCanvasLifeEnvironment({
        scene: owned.scene,
        stageTexture: owned.stage,
        prefilter: owned.prefilter,
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(failure)
    expect(owned.dispose).toHaveBeenCalledTimes(1)
    expect(owned.sourceDispose).toHaveBeenCalledTimes(1)
  })
})
