import { useLayoutEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { FrameClock } from './FrameClock'
import { StageFramePath } from './StageFramePath'
import { StagePresenter } from './StagePresenter'
import { StageFramePathContext } from './stageFrameContext'

type StageFramesProps = {
  readonly clock: FrameClock
  // Fires after the first frame the stage presented.
  readonly onFirstFrame: () => void
  // The stage's own report of a frame that threw while no product owned the
  // stage's frames.
  readonly onFrameFailure: (error: Error) => void
  // The stage's content, which runs its frame callbacks and registers its
  // failure ownership through the frame path in context.
  readonly children: ReactNode
}

// The stage's frames inside the Canvas, one set per canvas mount: the frame
// path, which owns what a frame throws, and the present every frame runs
// through, both handed to the content. The stage's own report owns the
// stage scope for the canvas's life, so a frame that fails under no product
// fails the stage renderer, never nobody. The path presents again through
// the canvas's own invalidate.
export function StageFrames({ clock, onFirstFrame, onFrameFailure, children }: StageFramesProps) {
  const invalidate = useThree((state) => state.invalidate)
  const [frames] = useState(() => new StageFramePath({ invalidate: () => invalidate() }))

  useLayoutEffect(() => frames.own('stage', onFrameFailure), [frames, onFrameFailure])

  return (
    <StageFramePathContext.Provider value={frames}>
      <StagePresenter clock={clock} onFirstFrame={onFirstFrame} />
      {children}
    </StageFramePathContext.Provider>
  )
}
