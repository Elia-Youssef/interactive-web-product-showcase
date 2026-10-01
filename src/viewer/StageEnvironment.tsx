import { useCallback, useEffect } from 'react'
import { useEnvironment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three/webgpu'
import { stageConfig } from './config'
import { useStageHold } from './stageHoldsContext'
import { isStageRenderer } from './stageIdentity'
import { useStageSettle } from './stageSettleContext'

// The stage's lighting: the studio environment preprocessed into the PMREM
// the node pipeline samples, on the scene for reflections only, never a
// background. The preprocessing runs here, at
// load, with the renderer's own generator: left to the node system it
// happens lazily inside the first render that samples it, and under demand
// mode the stage would come to rest on a frame the environment had not
// reached yet.
//
// The source texture comes out of the loader cache, so it lives as the
// stage's hold on it: once the hold is gone for good it is disposed and its
// cache entry cleared, with the same options it was loaded with, and a later
// mount loads a fresh texture instead of reusing the disposed one. While the
// component stays mounted the entry stays, so a re-render never suspends the
// stage's content again.
//
// Assigning the environment is a scene mutation: the lit materials rebuild
// their render pipelines for it, so the assignment settles the stage, which
// compiles the lit scene, presents it and holds the stage's settled promise
// until that frame is recorded.
const environmentOptions = { files: stageConfig.environmentFile }

export function StageEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const settleScene = useStageSettle()
  const equirectangular = useEnvironment(environmentOptions)

  const releaseSource = useCallback(() => {
    equirectangular.dispose()
    useEnvironment.clear(environmentOptions)
  }, [equirectangular])
  useStageHold(equirectangular, releaseSource)

  useEffect(() => {
    if (!isStageRenderer(gl)) {
      throw new Error('the stage environment needs the WebGPURenderer its factory built')
    }
    const generator = new PMREMGenerator(gl)
    const prefiltered = generator.fromEquirectangular(equirectangular)
    generator.dispose()

    const previous = scene.environment
    scene.environment = prefiltered.texture
    let cancelled = false
    settleScene().then(undefined, (error: unknown) => {
      // An unmount during the settle drops the failure with the stage; a
      // live failure stays loud on the console for the console gate.
      if (cancelled) {
        return
      }
      throw error
    })
    return () => {
      cancelled = true
      scene.environment = previous
      prefiltered.dispose()
    }
  }, [gl, scene, settleScene, equirectangular])

  return null
}
