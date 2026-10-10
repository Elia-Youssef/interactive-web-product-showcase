import { createContext, useContext } from 'react'
import type { StagePointerGestures } from '@lib/input/StagePointerGestures'

// Input consumers share the gesture classification of the canvas life
// they render over. A retired canvas leaves no pending input behind.
export const StagePointerGesturesContext = createContext<StagePointerGestures | null>(null)

export function useStagePointerGestures(): StagePointerGestures {
  const gestures = useContext(StagePointerGesturesContext)
  if (gestures === null) throw new Error('stage input renders inside its canvas life')
  return gestures
}
