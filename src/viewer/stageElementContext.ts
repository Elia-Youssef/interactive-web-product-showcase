import { createContext, useContext, type RefObject } from 'react'

// The stage's DOM boundary, shared with its overlay content. It is bound
// before effects run, so input listeners belong to this stage and leave
// with the feature that registered them.
export const StageElementContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function useStageElement(): RefObject<HTMLElement | null> {
  const element = useContext(StageElementContext)
  if (element === null) {
    throw new Error('a component that reads the stage element renders outside the stage')
  }
  return element
}
