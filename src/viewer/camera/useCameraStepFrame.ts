import { useCallback, useState } from 'react'
import type { FrameSchedule } from '@lib/camera/cameraStep'
import { useStageFrame } from '../stageFrameContext'

// The frame the stage camera's merged steps run on: a step scheduled now
// asks the stage for a frame and runs at its start, on the stage's frame
// path, ahead of the controls' own update, so the frame that runs the step
// already draws the move it began. One pending flush at a time, which is
// all the step coalescer asks for: it schedules again only after a flush.

// Ahead of the controls' frame step (-1, useStageControls), which applies
// what the step set on the same frame.
const CAMERA_STEP_PRIORITY = -2

// The pending flush, run once by the next frame.
export class PendingStepFrame {
  private flush: (() => void) | null = null

  schedule(flush: () => void, requestFrame: () => void): () => void {
    this.flush = flush
    requestFrame()
    return () => {
      if (this.flush === flush) {
        this.flush = null
      }
    }
  }

  run(): void {
    const flush = this.flush
    this.flush = null
    flush?.()
  }
}

export function useCameraStepFrame(invalidate: () => void): FrameSchedule {
  const [frame] = useState(() => new PendingStepFrame())
  useStageFrame('stage', () => frame.run(), CAMERA_STEP_PRIORITY)
  return useCallback((flush) => frame.schedule(flush, invalidate), [frame, invalidate])
}
