import { createContext, useContext } from 'react'
import type { StageProbes } from './StageProbes'

// The context that hands the stage's probes to its content, next to the
// settle and the holds. R3F bridges outer context into the canvas, so a
// component that arrives as the stage's opaque content node registers its
// probe through the stage's own instance, and the automation bridge outside
// the canvas reads the same instance through its prop.

export const StageProbesContext = createContext<StageProbes | null>(null)

// The stage's probes around the calling component. A component that
// registers a probe but renders outside the stage is a composition error, so
// it fails loudly instead of registering into nothing.
export function useStageProbes(): StageProbes {
  const probes = useContext(StageProbesContext)
  if (probes === null) {
    throw new Error('a component that registers a stage probe renders outside the stage')
  }
  return probes
}
