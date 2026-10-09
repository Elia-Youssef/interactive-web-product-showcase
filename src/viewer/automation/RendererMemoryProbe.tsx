import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { isStageRenderer } from '@viewer/stageIdentity'
import { useStageProbes } from './stageProbesContext'
import { rendererMemoryOf } from './rendererMemoryReading'

// The stage's memory probe: the live renderer's own counters of the
// resources it holds, and the size of the WebGL2 fallback's vertex array
// cache behind them, read from the renderer at access time.
// It registers a reader and owns nothing else; there is no per-frame work
// and no copy that can go stale.
export function RendererMemoryProbe() {
  const gl = useThree((state) => state.gl)
  const probes = useStageProbes()

  useEffect(
    () =>
      probes.register('memory', () => {
        if (!isStageRenderer(gl)) {
          throw new Error('the stage memory probe needs the WebGPURenderer its factory built')
        }
        return rendererMemoryOf(gl.info.memory, gl.backend)
      }),
    [gl, probes],
  )

  return null
}
