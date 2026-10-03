import { createContext, useContext } from 'react'
import type { StageOverlay } from './StageOverlay'

// The context that hands the stage's overlay channel to both of its sides:
// the overlay's DOM content mounts its elements through it, and the canvas
// content writes the placements through it. R3F bridges outer context into
// the canvas, so one stage instance serves both.

export const StageOverlayContext = createContext<StageOverlay | null>(null)

// The stage's overlay channel around the calling component. A component that
// mounts overlay elements or writes placements but renders outside the stage
// is a composition error, so it fails loudly instead of writing into a
// channel nothing shows.
export function useStageOverlay(): StageOverlay {
  const overlay = useContext(StageOverlayContext)
  if (overlay === null) {
    throw new Error('a component that uses the stage overlay renders outside the stage')
  }
  return overlay
}
