import type { Scene, Texture } from 'three/webgpu'

// The prefiltered environment a renderer builds from a source texture: the
// texture the scene samples and the release of everything built for it.
// PMREMGenerator's render target carries this shape.
export type PrefilteredEnvironment = {
  readonly texture: Texture
  dispose(): void
}

export type CanvasLifeEnvironment = {
  readonly scene: Scene
  // The stage's decoded environment, which outlives every canvas life.
  readonly stageTexture: Texture
  // The canvas life's renderer prefiltering a source texture.
  readonly prefilter: (source: Texture) => PrefilteredEnvironment
}

function releaseCanvasLifeEnvironment(
  source: Texture,
  prefiltered: PrefilteredEnvironment | undefined,
): void {
  try {
    prefiltered?.dispose()
  } finally {
    source.dispose()
  }
}

// Puts the stage's environment on one canvas life's scene and returns the
// release that takes it off again.
//
// The renderer never sees the stage's texture. A renderer that uploads a
// texture registers a dispose listener on it that closes over the renderer
// itself, and only that texture's own dispose removes it; the stage's
// texture outlives every canvas life, so a renderer handed it directly would
// stay reachable after its canvas life retired. The canvas life prefilters a
// texture of its own instead: a copy shares the decoded source
// (Texture.copy keeps the source object, with its data and version), so no
// pixel is decoded or held twice, and the release disposes the copy with
// the prefiltered result, which drops everything the renderer recorded.
export function installCanvasLifeEnvironment(input: CanvasLifeEnvironment): () => void {
  const source = input.stageTexture.clone()
  let prefiltered: PrefilteredEnvironment | undefined
  // Until the scene assignment succeeds and its release is handed back,
  // every acquired resource is still the installer's responsibility.
  try {
    prefiltered = input.prefilter(source)
    const previous = input.scene.environment
    input.scene.environment = prefiltered.texture
    return () => {
      try {
        input.scene.environment = previous
      } finally {
        releaseCanvasLifeEnvironment(source, prefiltered)
      }
    }
  } catch (error) {
    try {
      releaseCanvasLifeEnvironment(source, prefiltered)
    } catch {
      // Installation remains the reported cause if rollback also fails.
      throw error
    }
    throw error
  }
}
