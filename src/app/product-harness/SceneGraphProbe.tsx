import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Mesh } from 'three'

// The dev-only scene-graph read the scene-purity proof uses: how many
// meshes the stage scene holds, counted at access time. The finishes' own
// nodes are the only ones a feature could smuggle in, so the count against
// the model's own mesh count is the whole check. Dev-only, like the
// harness that mounts it.
export function SceneGraphProbe() {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    window.__harnessSceneMeshes = () => {
      let meshes = 0
      scene.traverse((node) => {
        if (node instanceof Mesh) {
          meshes += 1
        }
      })
      return meshes
    }
    return () => {
      if (window.__harnessSceneMeshes !== undefined) {
        delete window.__harnessSceneMeshes
      }
    }
  }, [scene])

  return null
}

declare global {
  interface Window {
    __harnessSceneMeshes?: () => number
  }
}
