import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTexture } from 'three/webgpu'
import { useStageFrame } from '@viewer/stageFrameContext'

// How many rendered frames the warm-up mesh stays in the scene for: one
// frame draws it, and the flag goes up as soon as that draw happened.
const WARMUP_FRAMES = 1

// The warm-up probe mesh, sized to stay inside any stage framing.
const warmupMesh = {
  radiusM: 0.1,
  segments: 16,
  colorHex: 0x808080,
} as const

// The stage's renderer warms three's lazily created internals before the
// disposal proof measures its baseline. Two of them never leave:
// the tone-mapping framebuffer target exists from the first frame, and the
// IBL specular lookup is a DataTexture three's node system builds on demand
// and keeps for the renderer's lifetime. The lookup is only built when a
// physically based material that carries a lighting node renders, so a bare
// mesh is not enough: the probe carries a one-texel ambient occlusion map,
// exactly the slot a product's baked AO arrives in. A stage that never drew
// such a material reads one texture short of a stage that drew and removed
// a product, which an exact teardown comparison would report as a leak. One
// draw makes both internals exist, deterministically, on both backends.
// Dev-only, like the harness that mounts it.
export function StageWarmup() {
  const [warm, setWarm] = useState(false)
  const renderedFrames = useRef(0)

  // A fresh texture per mount, owned by this component: it is disposed once
  // the warm draw is done, so the empty stage the proof measures holds
  // nothing of the warm-up but three's own persistent internals.
  const aoMap = useMemo(() => {
    const texel = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    texel.needsUpdate = true
    return texel
  }, [])

  useStageFrame('stage', () => {
    renderedFrames.current += 1
    if (renderedFrames.current === WARMUP_FRAMES) {
      setWarm(true)
    }
  })

  useEffect(() => {
    if (warm) {
      aoMap.dispose()
      window.__harnessStageWarm = true
    }
  }, [warm, aoMap])

  if (warm) {
    return null
  }
  return (
    <mesh>
      <sphereGeometry args={[warmupMesh.radiusM, warmupMesh.segments, warmupMesh.segments]} />
      <meshPhysicalMaterial color={warmupMesh.colorHex} aoMap={aoMap} />
    </mesh>
  )
}

declare global {
  interface Window {
    __harnessStageWarm?: boolean
  }
}
