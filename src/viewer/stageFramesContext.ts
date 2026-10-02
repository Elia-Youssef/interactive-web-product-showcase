import { createContext, useContext, useEffect } from 'react'
import type { PresentedFrameListener, PresentedFrames } from './PresentedFrames'

// The context that hands the stage's presented-frame channel to its content,
// next to the settle, the holds and the probes. R3F bridges outer context
// into the canvas, so a component inside the stage's content subscribes to
// the channel of the stage it renders in, and the stage's own frame observer
// feeds the same instance.

export const StageFramesContext = createContext<PresentedFrames | null>(null)

// The stage's presented frames around the calling component. A component
// that subscribes but renders outside the stage is a composition error, so
// it fails loudly instead of waiting on a channel that will never fire.
export function useStageFrames(): PresentedFrames {
  const frames = useContext(StageFramesContext)
  if (frames === null) {
    throw new Error('a component that subscribes to presented frames renders outside the stage')
  }
  return frames
}

// Runs the listener once per presented frame of the stage, for as long as
// the calling component's effects are live. Subscribing owes one frame, so a
// subscriber that arrives while the stage is at rest still gets its first
// frame; the listener identity joins the effect, so a re-subscription owes
// and gets another frame.
export function usePresentedFrame(listener: PresentedFrameListener): void {
  const frames = useStageFrames()
  useEffect(() => frames.add(listener), [frames, listener])
}
