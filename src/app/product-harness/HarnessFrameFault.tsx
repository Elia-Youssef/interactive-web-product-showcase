import { useCallback, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControlsImpl } from '@react-three/drei'
import { useAppStore } from '@store/index'
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
    case 'camera':
      return <CameraFault />
  }
}

// Throws from the stage camera's own frame step: once the product is
// presented, the controls' update throws on every frame. The stage camera's
// controls are its own instance, reached by no other code, so the fault
// replaces the update on the controls class for as long as it is mounted
// and puts it back on unmount; the camera is the only user of the class on
// the harness page. Dev-only, like the harness.
function CameraFault() {
  const presented = useAppStore((state) => state.productStatus.kind === 'ready')
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!presented) {
      return
    }
    const { prototype } = CameraControlsImpl
    const update = Object.getOwnPropertyDescriptor(prototype, 'update')
    if (update === undefined) {
      throw new Error('the camera controls class carries no update to fault')
    }
    Object.defineProperty(prototype, 'update', {
      ...update,
      value: () => {
        throw new Error(frameFaultMessage('camera'))
      },
    })
    invalidate()
    return () => {
      Object.defineProperty(prototype, 'update', update)
    }
  }, [presented, invalidate])

  return null
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
