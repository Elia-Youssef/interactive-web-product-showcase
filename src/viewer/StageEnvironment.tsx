import { useEffect } from 'react'
import { useEnvironment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three/webgpu'
import { stageConfig } from './config'
import { isStageRenderer } from './stageIdentity'

// The stage's lighting: the studio environment preprocessed into the PMREM
// the node pipeline samples, on the scene for reflections only, never a
// background. The preprocessing runs here, at
// load, with the renderer's own generator: left to the node system it
// happens lazily inside the first render that samples it, and under demand
// mode the stage would come to rest on a frame the environment had not
// reached yet.
export function StageEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const equirectangular = useEnvironment({ files: stageConfig.environmentFile })

  useEffect(() => {
    if (!isStageRenderer(gl)) {
      throw new Error('the stage environment needs the WebGPURenderer its factory built')
    }
    const generator = new PMREMGenerator(gl)
    const prefiltered = generator.fromEquirectangular(equirectangular)
    generator.dispose()

    const previous = scene.environment
    scene.environment = prefiltered.texture
    return () => {
      scene.environment = previous
      prefiltered.dispose()
      equirectangular.dispose()
    }
  }, [gl, scene, equirectangular])

  return null
}
