import { createContext, useCallback, useContext } from 'react'
import { useThree } from '@react-three/fiber'
import { assertStageRenderer } from './stageIdentity'
import type { StageSettle } from './StageSettle'

// The context that hands the canvas's scene settle to its content. The
// stage's frames provide it inside the Canvas, one chain per canvas mount,
// since a settle step presents through its canvas: a step pending on a
// canvas that was replaced belongs to that canvas, never to the chain the
// fresh canvas's content settles through.

export const StageSettleContext = createContext<StageSettle | null>(null)

// The settle call of the stage the component renders in. It presents the
// scene as it stands, twice, and resolves once the chain around the call
// has drained and both frames are recorded. A rejection reaches the caller:
// the shared failure reporter ends disposal quietly; other failures reach
// the product channel or stay loud on the console. The call is stable for
// the life of the canvas, so an effect can settle without
// rerunning on every render.
export function useStageSettle(): () => Promise<void> {
  const settle = useContext(StageSettleContext)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const settleScene = useCallback((): Promise<void> => {
    if (settle === null) {
      throw new Error(
        'a component that mutates the scene renders outside the stage that would settle it',
      )
    }
    assertStageRenderer(gl)
    return settle.settle({ invalidate })
  }, [settle, gl, invalidate])
  return settleScene
}
