import { createContext, useCallback, useContext } from 'react'
import { useThree } from '@react-three/fiber'
import { assertStageRenderer } from './stageIdentity'
import type { StageSettle } from './StageSettle'

// The context that hands the stage's scene settle to its content. R3F
// bridges outer context into the canvas, so a mutation component that
// arrives as the stage's opaque content node can settle through the stage's
// own chain.

export const StageSettleContext = createContext<StageSettle | null>(null)

// The settle call of the stage the component renders in. It compiles the
// scene as it stands with the live renderer, scene and camera, presents it,
// and resolves once the chain around the call has drained and the frame is
// recorded. A rejection reaches the caller: the product channel turns it into
// the product's typed failure, and the environment leaves it loud on the
// console. The call is stable for the life of the canvas, so an effect can settle without
// rerunning on every render.
export function useStageSettle(): () => Promise<void> {
  const settle = useContext(StageSettleContext)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const settleScene = useCallback((): Promise<void> => {
    if (settle === null) {
      throw new Error(
        'a component that mutates the scene renders outside the stage that would settle it',
      )
    }
    assertStageRenderer(gl)
    return settle.settle({ gl, scene, camera, invalidate })
  }, [settle, gl, scene, camera, invalidate])
  return settleScene
}
