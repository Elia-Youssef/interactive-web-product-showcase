import { useEffect } from 'react'
import { addAfterEffect, addEffect, useThree } from '@react-three/fiber'
import type { FrameClock } from './FrameClock'
import { assertStageRenderer } from './stageIdentity'

type FrameObserverProps = {
  readonly clock: FrameClock
  // Called once, after the first frame this observer saw actually render.
  readonly onFirstFrame: () => void
}

// The only per-frame code of the stage. R3F's global effects fire on every
// loop tick, including ticks that render no root, so a frame is counted only
// when the renderer's own render counter moved: renderer.info.render.calls,
// which three r186 increments once per render pass, and the scene and its
// output pass make two passes per frame. Only the delta counts. The recorded
// duration is the CPU time of the whole loop tick, from the before-effect to
// the after-effect; GPU time is a different measurement.
export function FrameObserver({ clock, onFirstFrame }: FrameObserverProps) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    assertStageRenderer(gl)
    let lastRenderCalls = gl.info.render.calls
    let tickStartMs = performance.now()
    // The first frame this observer saw. The flag lives in this effect run,
    // never in a count that outlives the stage: a remounted stage must
    // signal its own first frame, or its status stays initializing forever.
    let firstFrameSeen = false
    const unsubscribeBefore = addEffect(() => {
      tickStartMs = performance.now()
    })
    const unsubscribeAfter = addAfterEffect(() => {
      const renderCalls = gl.info.render.calls
      if (renderCalls === lastRenderCalls) {
        return
      }
      lastRenderCalls = renderCalls
      const atMs = performance.now()
      clock.recordFrame(atMs, atMs - tickStartMs)
      if (!firstFrameSeen) {
        firstFrameSeen = true
        onFirstFrame()
      }
    })
    // Under demand mode nothing after mount may assume a frame will come:
    // a blank stage changes no scene graph and no R3F state of its own, so
    // the observer owes the frame its first-frame signal waits for. (R3F's
    // own activation currently invalidates once, and readiness failed at
    // random when it relied on that timing.)
    invalidate()
    return () => {
      unsubscribeBefore()
      unsubscribeAfter()
    }
  }, [gl, invalidate, clock, onFirstFrame])

  return null
}
