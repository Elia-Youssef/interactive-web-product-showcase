import { describe, expect, it } from 'vitest'
import {
  DataTexture,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  Scene,
  Texture,
} from 'three/webgpu'
import { installCanvasLifeEnvironment, type PrefilteredEnvironment } from './canvasLifeEnvironment'

// A stand-in for one canvas life's renderer: it records every texture it
// prefilters and, like the renderer's texture bookkeeping, registers a
// dispose listener on it that only that texture's own dispose removes.
function fakeRenderer(): {
  readonly prefilter: (source: Texture) => PrefilteredEnvironment
  readonly seen: Texture[]
  readonly held: () => Texture[]
  readonly prefilteredDisposals: () => number
} {
  const seen: Texture[] = []
  const held = new Set<Texture>()
  let prefilteredDisposals = 0
  return {
    prefilter: (source) => {
      seen.push(source)
      held.add(source)
      const release = (): void => {
        held.delete(source)
        source.removeEventListener('dispose', release)
      }
      source.addEventListener('dispose', release)
      return {
        texture: new Texture(),
        dispose: () => {
          prefilteredDisposals += 1
        },
      }
    },
    seen,
    held: () => [...held],
    prefilteredDisposals: () => prefilteredDisposals,
  }
}

function stageTexture(): DataTexture {
  const texture = new DataTexture(new Float32Array(16), 2, 2)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = LinearSRGBColorSpace
  return texture
}

describe('installCanvasLifeEnvironment', () => {
  it('prefilters a texture of its own over the stage source, never the stage texture', () => {
    const stage = stageTexture()
    const renderer = fakeRenderer()

    installCanvasLifeEnvironment({
      scene: new Scene(),
      stageTexture: stage,
      prefilter: renderer.prefilter,
    })

    const [source] = renderer.seen
    expect(source).toBeDefined()
    expect(source).not.toBe(stage)
    expect(source?.source).toBe(stage.source)
    expect(source?.mapping).toBe(EquirectangularReflectionMapping)
    expect(source?.colorSpace).toBe(LinearSRGBColorSpace)
  })

  it('releases everything the retired renderer holds and restores the scene', () => {
    const stage = stageTexture()
    const scene = new Scene()
    const before = new Texture()
    scene.environment = before
    const renderer = fakeRenderer()

    const uninstall = installCanvasLifeEnvironment({
      scene,
      stageTexture: stage,
      prefilter: renderer.prefilter,
    })
    expect(scene.environment).not.toBe(before)
    expect(renderer.held()).toHaveLength(1)

    uninstall()
    expect(renderer.held()).toEqual([])
    expect(renderer.prefilteredDisposals()).toBe(1)
    expect(scene.environment).toBe(before)
  })

  it('gives every canvas life its own texture, and one life ending frees only its own', () => {
    const stage = stageTexture()
    const retired = fakeRenderer()
    const live = fakeRenderer()

    const uninstallRetired = installCanvasLifeEnvironment({
      scene: new Scene(),
      stageTexture: stage,
      prefilter: retired.prefilter,
    })
    installCanvasLifeEnvironment({
      scene: new Scene(),
      stageTexture: stage,
      prefilter: live.prefilter,
    })
    uninstallRetired()

    expect(retired.held()).toEqual([])
    expect(live.held()).toHaveLength(1)
    expect(live.seen[0]?.source).toBe(stage.source)
    expect(live.seen[0]).not.toBe(retired.seen[0])
  })
})
