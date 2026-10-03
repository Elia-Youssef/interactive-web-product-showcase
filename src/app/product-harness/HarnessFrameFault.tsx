import { useCallback } from 'react'
import { useStageFrame } from '@viewer/stageFrameContext'
import type { FrameOwnerScope } from '@viewer/StageFramePath'
import {
  frameFaultMessage,
  type HarnessFrameFault as Fault,
  type HarnessFrameFaultScope,
} from './frameFaultQuery'

// The size of the fault's own mesh, small enough to sit inside any product
// at the stage origin: it only has to be in the render list, never seen.
const faultMeshSizeM = 0.001

// The frame owner scope whose code a fault of each harness scope stands
// for: a fault inside the product is the product's code, one beside it the
// stage's.
const faultFrameScopes: Readonly<Record<HarnessFrameFaultScope, FrameOwnerScope>> = {
  product: 'content',
  stage: 'stage',
}

// A dev-only fault that throws inside every frame presenting it, at the
// place it names. Its scope decides whose frames it breaks: inside the
// presented product, the product's; beside it, the stage's.
export function HarnessFrameFault({ fault }: { readonly fault: Fault }) {
  switch (fault.place) {
    case 'present':
      return <PresentFault />
    case 'callback':
      return <CallbackFault scope={faultFrameScopes[fault.scope]} />
  }
}

// Throws from the mesh's own render hook, which the renderer calls for
// every object it draws, inside the present. Never frustum culled, so every
// present reaches it.
function PresentFault() {
  const throwInPresent = useCallback(() => {
    throw new Error(frameFaultMessage('present'))
  }, [])
  return (
    <mesh onBeforeRender={throwInPresent} frustumCulled={false}>
      <boxGeometry args={[faultMeshSizeM, faultMeshSizeM, faultMeshSizeM]} />
      <meshBasicMaterial />
    </mesh>
  )
}

// Throws from a frame callback of the scope's code, on every frame.
function CallbackFault({ scope }: { readonly scope: FrameOwnerScope }) {
  useStageFrame(scope, () => {
    throw new Error(frameFaultMessage('callback'))
  })
  return null
}
