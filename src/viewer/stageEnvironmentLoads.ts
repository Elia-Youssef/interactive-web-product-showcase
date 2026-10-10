// The stage's environment loads: one load per environment file, in a cache
// the stage owns rather than a module-wide one, mirroring the product model
// loads. There is no module-level cache, so a second stage loads its own,
// and every load is held and released through the stage that renders it.
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { EquirectangularReflectionMapping, LinearSRGBColorSpace, type Texture } from 'three/webgpu'
import { KeyedLoads, type KeyedLoad } from '@lib/async/keyedLoads'

// The environment loads of one stage: one load per environment file, shared
// by every reader of that file until the hold on it is released. The owner
// is the stage's environment provider (StageEnvironmentProvider), which
// renders above the canvas lives, so the loads live exactly as long as the
// stage itself.
export class StageEnvironmentLoads extends KeyedLoads<Texture> {
  release(entry: KeyedLoad<Texture>): void {
    if (!this.forget(entry)) {
      return
    }
    void entry.value.then(
      (texture) => texture.dispose(),
      () => undefined,
    )
  }
}

export function createStageEnvironmentLoads(): StageEnvironmentLoads {
  return new StageEnvironmentLoads((url) => {
    const load = loadStageEnvironment(url)
    // Ownership is committed before the suspended reader mounts. Retain
    // the original rejection for use(), with no unhandled gap in between.
    void load.catch(() => undefined)
    return load
  })
}

// One environment load: the equirect texture the PMREM preprocessing reads,
// with the mapping and color space the scene's environment sampling
// expects. The load rejects on a broken file or a failed fetch, which the
// reader's render routes to the stage's error boundary, the same channel
// every unexpected stage failure takes.
async function loadStageEnvironment(url: string): Promise<Texture> {
  const texture = await new HDRLoader().loadAsync(url)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = LinearSRGBColorSpace
  return texture
}
