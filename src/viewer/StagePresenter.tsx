import { useEffect, useRef } from 'react'
import { addEffect, useFrame, useThree } from '@react-three/fiber'
import type { FrameClock } from './FrameClock'
import { presentFrame } from './presentFrame'
import { assertStageRenderer } from './stageIdentity'
import { STAGE_PRESENT_PRIORITY, useStageFramePath } from './stageFrameContext'

type StagePresenterProps = {
  readonly clock: FrameClock
  // Called once, after the first frame this presenter presented.
  readonly onFirstFrame: () => void
}

// The stage's present: the one step of every frame that renders the scene,
// run through the stage's frame path and recorded on the stage's clock
// only when it presented, then followed by the presented-frame listeners.
// It holds a positive render priority, so R3F's loop leaves the render to
// it; a present that throws (a node build, an object's own render hook, the
// renderer itself) reaches the owner of the stage's frames instead of
// escaping the engine's frame loop, and a frame that did not present is
// never recorded, so nothing waiting on a presented frame is released by a
// frame that failed.
//
// The recorded duration is the CPU time of the loop tick, from R3F's
// before-effect to the end of the present; GPU time is a different
// measurement.
export function StagePresenter({ clock, onFirstFrame }: StagePresenterProps) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const frames = useStageFramePath()
  const tickStartMs = useRef(0)
  // The first frame this presenter's current effect run saw. It is reset by
  // the effect run, never carried in a count that outlives the stage: a
  // remounted stage must signal its own first frame, or its status stays
  // initializing forever.
  const firstFrameSeen = useRef(false)

  useEffect(() => {
    assertStageRenderer(gl)
    firstFrameSeen.current = false
    tickStartMs.current = performance.now()
    const unsubscribeBefore = addEffect(() => {
      tickStartMs.current = performance.now()
    })
    // Under demand mode nothing after mount may assume a frame will come:
    // a blank stage changes no scene graph and no R3F state of its own, so
    // the presenter owes the frame its first-frame signal waits for.
    invalidate()
    return unsubscribeBefore
  }, [gl, invalidate])

  useFrame((state) => {
    presentFrame(
      frames,
      () => state.gl.render(state.scene, state.camera),
      () => {
        const atMs = performance.now()
        clock.recordFrame(atMs, atMs - tickStartMs.current)
        if (!firstFrameSeen.current) {
          firstFrameSeen.current = true
          onFirstFrame()
        }
      },
    )
  }, STAGE_PRESENT_PRIORITY)

  return null
}
