import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { stageConfig } from './config'
import { assertStageRenderer, assertStageScene } from './stageIdentity'

// The stage's start-up rig, inside the Canvas: first the identity checks,
// then the settings that R3F's configure would overwrite or never writes.
// After an async gl factory R3F stamps its own tone mapping, and it leaves
// the clear color opaque; this effect runs inside the Canvas, after
// configure, so both writes land last and survive. A throw in
// the checks reaches the stage's error boundary through R3F's own, so a
// renderer or scene from a second copy of three fails start-up with a named
// reason instead of rendering.
export function RendererRig() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    assertStageRenderer(gl)
    assertStageScene(scene)
    gl.toneMapping = stageConfig.toneMapping
    gl.setClearColor(stageConfig.clearColorHex, stageConfig.clearAlpha)
  }, [gl, scene])

  return null
}
