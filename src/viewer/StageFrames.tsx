import { useLayoutEffect, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { FrameClock } from './FrameClock'
import { StageFramePath } from './StageFramePath'
import { StagePresenter } from './StagePresenter'
import { StageSettle } from './StageSettle'
import { StageFramePathContext } from './stageFrameContext'
import { StageSettleContext } from './stageSettleContext'

type StageFramesProps = {
  readonly clock: FrameClock
  // Fires after the first frame the stage presented.
  readonly onFirstFrame: () => void
  // The stage's own report of a frame that threw while no product owned the
  // stage's frames.
  readonly onFrameFailure: (error: Error) => void
  // The stage's word that this canvas's renderer is retired: a present
  // threw inside three's render. Stable for the life of the canvas mount,
  // since the path is built with it once.
  readonly onRendererRetired: () => void
  // The stage's content, which runs its frame callbacks and registers its
  // failure ownership through the frame path in context.
  readonly children: ReactNode
}

// The stage's frames inside the Canvas, one set per canvas mount: the frame
// path, which owns what a frame throws, the present every frame runs
// through, and the settle chain, all handed to the content. The stage's own
// report owns the stage scope for the canvas's life, so a frame that fails
// under no product fails the stage renderer, never nobody. The path
// presents again through the canvas's own invalidate, and a retired
// renderer is reported to the stage, which gives new content a fresh
// canvas.
export function StageFrames({
  clock,
  onFirstFrame,
  onFrameFailure,
  onRendererRetired,
  children,
}: StageFramesProps) {
  const invalidate = useThree((state) => state.invalidate)
  const [frames] = useState(
    () => new StageFramePath({ invalidate: () => invalidate(), retired: onRendererRetired }),
  )

  // The canvas's settle chain: its steps present through this canvas and
  // record on the stage's clock.
  const [settle] = useState(() => new StageSettle(clock))

  useLayoutEffect(() => frames.own('stage', onFrameFailure), [frames, onFrameFailure])

  return (
    <StageFramePathContext.Provider value={frames}>
      <StageSettleContext.Provider value={settle}>
        <StagePresenter clock={clock} onFirstFrame={onFirstFrame} />
        {children}
      </StageSettleContext.Provider>
    </StageFramePathContext.Provider>
  )
}
