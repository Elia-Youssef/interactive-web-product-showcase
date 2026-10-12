import { useEffect } from 'react'
import type CameraControlsImpl from 'camera-controls'
import type { CameraRequestCompletion } from '@lib/camera/requestCompletion'
import type { ControlsFrameClock } from './controlsFrameClock'

export function useControlsDemand(
  controls: CameraControlsImpl,
  frameClock: ControlsFrameClock,
  completion: CameraRequestCompletion,
  invalidate: () => void,
): void {
  // The demand frame loop renders on the controls' own events. The
  // move-start events, transitionstart and controlstart, also timestamp the
  // move's start; camera-controls fires them on every applied input step,
  // and the clock anchors on them only while the controls were asleep.
  useEffect(() => {
    const beginMove = () => {
      frameClock.beginMove(performance.now())
      completion.begin()
      invalidate()
    }
    const beginGesture = () => {
      completion.gesture(true)
      beginMove()
    }
    const endGesture = () => {
      completion.gesture(false)
      invalidate()
    }
    const invalidateOnly = () => invalidate()
    controls.addEventListener('controlstart', beginGesture)
    controls.addEventListener('controlend', endGesture)
    controls.addEventListener('transitionstart', beginMove)
    controls.addEventListener('control', invalidateOnly)
    controls.addEventListener('update', invalidateOnly)
    controls.addEventListener('wake', invalidateOnly)
    return () => {
      controls.removeEventListener('controlstart', beginGesture)
      controls.removeEventListener('controlend', endGesture)
      controls.removeEventListener('transitionstart', beginMove)
      controls.removeEventListener('control', invalidateOnly)
      controls.removeEventListener('update', invalidateOnly)
      controls.removeEventListener('wake', invalidateOnly)
    }
  }, [controls, frameClock, invalidate, completion])
}
