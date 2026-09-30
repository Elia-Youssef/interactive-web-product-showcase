import { createContext, useContext } from 'react'
import type { ModelWatch } from './ModelWatch'

// The context that hands the stage's model watch to its content. The stage
// provides it around everything it renders; R3F bridges outer context into
// the canvas, so a model component that arrives as the stage's opaque
// content node can reach the watch the automation hook reads.

export const StageModelContext = createContext<ModelWatch | null>(null)

export function useStageModelWatch(): ModelWatch {
  const watch = useContext(StageModelContext)
  if (watch === null) {
    throw new Error('a model component renders outside the stage that would report it')
  }
  return watch
}
