import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// The dev-only read of the live renderer's memory counters, for the
// disposal proof: geometries and textures, read from the renderer at
// access time. The probe installs a getter and owns nothing else; there is
// no per-frame work and no copy that can go stale.
export function RendererMemoryProbe() {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    window.__harnessRendererMemory = () => ({
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    })
    return () => {
      if (window.__harnessRendererMemory !== undefined) {
        delete window.__harnessRendererMemory
      }
    }
  }, [gl])

  return null
}

declare global {
  interface Window {
    __harnessRendererMemory?: () => { readonly geometries: number; readonly textures: number }
  }
}
